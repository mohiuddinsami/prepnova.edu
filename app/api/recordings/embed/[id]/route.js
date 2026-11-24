import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new NextResponse('<body style="background:#050805;color:white;display:flex;align-items:center;justify-content:center;font-family:sans-serif;"><h3>Authentication Required</h3></body>', { status: 401, headers: { 'Content-Type': 'text/html' } })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('premium_expires_at, user_level, admin_level')
    .eq('id', user.id)
    .single()

  let userLevel = profile?.user_level || 1
  const adminLevel = profile?.admin_level || 0

  if (userLevel >= 2 && profile?.premium_expires_at && new Date(profile.premium_expires_at) < new Date()) {
    userLevel = 1
  }

  const { searchParams } = new URL(request.url)
  const requestedVid = searchParams.get('vid')

  let { data: recording } = await supabase
    .from('classes')
    .select('video_id, required_level, recordings')
    .eq('id', id)
    .single()

  if (!recording) {
    const { data: fallback } = await supabase
      .from('class_recordings')
      .select('video_id')
      .eq('id', id)
      .single()
    recording = fallback
  }

  if (!recording) {
    return new NextResponse('<body style="background:#050805;color:white;display:flex;align-items:center;justify-content:center;font-family:sans-serif;"><h3>Recording Not Found</h3></body>', { status: 404, headers: { 'Content-Type': 'text/html' } })
  }

  const reqLevel = recording.required_level ?? 1

  if (userLevel < reqLevel && adminLevel < 7) {
    return new NextResponse(`<body style="background:#050805;color:#f59e0b;display:flex;align-items:center;justify-content:center;font-family:sans-serif;"><h3>🔒 Access Level ${reqLevel} Required to Watch this Masterclass</h3></body>`, { status: 403, headers: { 'Content-Type': 'text/html' } })
  }

  const rawVid = requestedVid || recording.video_id || (recording.recordings?.[0]?.video_id) || ''
  const vidMatch = String(rawVid).trim().match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=)|^)([\w-]{11})/i)
  const targetVideoId = vidMatch ? vidMatch[1] : String(rawVid).trim()

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PrepNova Secure Stream</title>
  <style>
    * { box-sizing: border-box; }
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: #050805; overflow: hidden; user-select: none; -webkit-user-select: none; font-family: system-ui, -apple-system, sans-serif; }
    
    #player-container { position: relative; width: 100vw; height: 100vh; background: #050805; display: flex; flex-direction: column; }
    
    /* Video Wrapper takes all space above the 64px control bar, preventing bottom overlap */
    #video-wrapper {
      position: relative; width: 100%; height: calc(100% - 64px);
      overflow: hidden; background: #050805; display: flex; align-items: center; justify-content: center;
    }
    
    /* Shift up by 54px to clip off YouTube title header and stretch width to remove black boxes */
    #player {
      position: absolute; top: -54px; left: -1%; width: 102%; height: calc(100% + 56px);
      pointer-events: none;
    }
    
    /* Transparent click shield intercepts all clicks inside video wrapper */
    .click-shield { 
      position: absolute; top: 0; left: 0; right: 0; bottom: 0; 
      z-index: 10; cursor: pointer; background: transparent; 
    }

    /* Custom EdTech Bottom Control Bar */
    .control-bar {
      position: absolute; bottom: 0; left: 0; right: 0; height: 64px;
      background: linear-gradient(to top, rgba(5,8,5,0.98), rgba(5,8,5,0.85));
      backdrop-filter: blur(12px); border-top: 1px solid rgba(255,255,255,0.1);
      z-index: 20; display: flex; align-items: center; justify-content: space-between;
      padding: 0 20px; gap: 16px; color: #fff;
    }

    .btn-group { display: flex; align-items: center; gap: 12px; position: relative; }
    
    button {
      background: none; border: none; color: #e5e7eb; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      padding: 8px; border-radius: 8px; transition: all 0.2s;
    }
    button:hover { color: #D0F288; background: rgba(255,255,255,0.05); transform: scale(1.05); }
    button:active { transform: scale(0.95); }

    .icon { width: 22px; height: 22px; fill: currentColor; }

    /* Time Display */
    .time-display { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; color: #d1d5db; white-space: nowrap; }

    /* Seek & Volume Sliders */
    input[type="range"] {
      -webkit-appearance: none; appearance: none; background: rgba(255,255,255,0.2);
      border-radius: 4px; cursor: pointer; outline: none; transition: 0.2s;
    }
    
    #seek-bar {
      position: absolute; top: -5px; left: 0; right: 0; width: 100%; height: 5px;
      margin: 0; border-radius: 0; accent-color: #D0F288; z-index: 25; background: rgba(255,255,255,0.15);
    }
    #seek-bar:hover { height: 8px; top: -8px; background: rgba(255,255,255,0.25); }
    #seek-bar::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none; width: 14px; height: 14px;
      border-radius: 50%; background: #D0F288; cursor: pointer;
      box-shadow: 0 0 10px rgba(208,242,136,0.8); transition: 0.1s;
    }
    #seek-bar::-webkit-slider-thumb:hover { transform: scale(1.3); }

    #vol-bar { width: 65px; height: 4px; accent-color: #ffffff; background: rgba(255,255,255,0.25); }
    #vol-bar::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none; width: 10px; height: 10px;
      border-radius: 50%; background: #ffffff; cursor: pointer; transition: 0.1s;
    }
    #vol-bar::-webkit-slider-thumb:hover { transform: scale(1.2); }

    /* Popup Dropdown Menus */
    .popup-menu {
      position: absolute; bottom: 74px;
      background: rgba(18, 24, 18, 0.95); backdrop-filter: blur(16px);
      border: 1px solid rgba(255,255,255,0.15); border-radius: 12px;
      padding: 6px; z-index: 30; display: none; flex-direction: column; gap: 2px;
      min-width: 130px; box-shadow: 0 10px 30px rgba(0,0,0,0.8);
      animation: fadeIn 0.15s ease-out; max-height: 260px; overflow-y: auto;
    }
    #quality-menu { right: 20px; }
    #speed-menu { right: 70px; min-width: 110px; }

    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
    
    .quality-item {
      padding: 8px 12px; border-radius: 8px; font-size: 13px; font-weight: 700;
      color: #e5e7eb; cursor: pointer; display: flex; align-items: center; justify-content: space-between;
      transition: all 0.15s; background: transparent; width: 100%; border: none; text-align: left;
    }
    .quality-item:hover { background: rgba(255,255,255,0.08); color: #fff; transform: none; }
    .quality-item.active { color: #D0F288; background: rgba(208,242,136,0.1); }
  </style>
</head>
<body oncontextmenu="return false;" onkeydown="return false;" ondragstart="return false;">
  
  <div id="player-container">
    <div id="video-wrapper">
      <div id="player"></div>
      <div class="click-shield" id="click-shield" title="Click to Play/Pause"></div>
    </div>

    <div class="popup-menu" id="quality-menu">
      <!-- Dynamically populated based on video's available qualities -->
    </div>

    <div class="popup-menu" id="speed-menu">
      <button class="quality-item" data-speed="0.25">0.25x <span></span></button>
      <button class="quality-item" data-speed="0.5">0.5x <span></span></button>
      <button class="quality-item" data-speed="0.75">0.75x <span></span></button>
      <button class="quality-item active" data-speed="1">Normal <span>✓</span></button>
      <button class="quality-item" data-speed="1.25">1.25x <span></span></button>
      <button class="quality-item" data-speed="1.5">1.5x <span></span></button>
      <button class="quality-item" data-speed="1.75">1.75x <span></span></button>
      <button class="quality-item" data-speed="2">2x <span></span></button>
    </div>

    <div class="control-bar">
      <div class="btn-group">
        <button id="play-pause-btn" title="Play/Pause (Space)">
          <svg class="icon" id="play-icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          <svg class="icon" id="pause-icon" viewBox="0 0 24 24" style="display:none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        </button>
        <button id="rewind-btn" title="Rewind 10s (Left Arrow)">
          <svg class="icon" viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
        </button>
        <button id="forward-btn" title="Forward 10s (Right Arrow)">
          <svg class="icon" viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
        </button>
      </div>

      <input type="range" id="seek-bar" min="0" max="100" value="0" step="0.1" title="Seek">

      <span class="time-display" id="time-display">00:00 / 00:00</span>

      <div class="btn-group">
        <button id="mute-btn" title="Mute/Unmute">
          <svg class="icon" id="vol-icon" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
        </button>
        <input type="range" id="vol-bar" min="0" max="100" value="100" title="Volume">
        
        <button id="speed-btn" title="Playback Speed" style="font-size: 13px; font-weight: 700; padding: 6px 10px; background: rgba(255,255,255,0.08);">
          <span id="speed-label">1x</span>
        </button>

        <button id="quality-btn" title="Video Quality">
          <svg class="icon" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
        </button>

        <button id="fs-btn" title="Fullscreen">
          <svg class="icon" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
        </button>
      </div>
    </div>
  </div>

  <script src="https://www.youtube.com/iframe_api"></script>
  <script>
    let player;
    let isPlaying = false;
    let isSeeking = false;
    let updateInterval;
    let userSelectedQuality = null;

    const qualityLabels = {
      'highres': '4K High Res',
      'hd2160': '4K (2160p)',
      'hd1440': '2K (1440p)',
      'hd1080': '1080p HD',
      'hd720': '720p HD',
      'large': '480p',
      'medium': '360p',
      'small': '240p',
      'tiny': '144p',
      'auto': 'Auto'
    };

    function formatTime(seconds) {
      if (!seconds || isNaN(seconds)) return "00:00";
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      const mStr = (h > 0 ? (m < 10 ? "0" + m : m) : m) + ":";
      const sStr = s < 10 ? "0" + s : s;
      return (h > 0 ? h + ":" : "") + mStr + sStr;
    }

    function onYouTubeIframeAPIReady() {
      player = new YT.Player('player', {
        videoId: '${targetVideoId}',
        playerVars: {
          autoplay: 1, controls: 0, rel: 0, modestbranding: 1, showinfo: 0, disablekb: 1, iv_load_policy: 3, playsinline: 1, enablejsapi: 1, origin: window.location.origin
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange
        }
      });
    }

    function onPlayerReady(event) {
      event.target.playVideo();
      updateInterval = setInterval(updateProgress, 250);
      updateQualityMenu();
    }

    function onPlayerStateChange(event) {
      const playIcon = document.getElementById('play-icon');
      const pauseIcon = document.getElementById('pause-icon');
      if (event.data === YT.PlayerState.PLAYING) {
        isPlaying = true;
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
        updateQualityMenu();
      } else {
        isPlaying = false;
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
      }
    }

    function updateProgress() {
      if (!player || !player.getDuration || isSeeking) return;
      const curr = player.getCurrentTime() || 0;
      const dur = player.getDuration() || 0;
      if (dur > 0) {
        document.getElementById('seek-bar').value = (curr / dur) * 100;
        document.getElementById('time-display').innerText = formatTime(curr) + " / " + formatTime(dur);
      }
    }

    function updateQualityMenu() {
      if (!player || !player.getAvailableQualityLevels) return;
      const levels = player.getAvailableQualityLevels();
      const menu = document.getElementById('quality-menu');
      
      // If levels are available, populate them dynamically
      if (levels && levels.length > 0) {
        const currentQuality = userSelectedQuality || player.getPlaybackQuality() || 'auto';
        menu.innerHTML = '';

        levels.forEach(q => {
          const label = qualityLabels[q] || q.toUpperCase();
          const btn = document.createElement('button');
          btn.className = 'quality-item' + (q === currentQuality ? ' active' : '');
          btn.setAttribute('data-quality', q);
          btn.innerHTML = label + ' <span>' + (q === currentQuality ? '✓' : '') + '</span>';
          
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            userSelectedQuality = q;
            if (player) {
              const currentTime = player.getCurrentTime() || 0;
              if (player.loadVideoById) {
                player.loadVideoById({
                  videoId: '${targetVideoId}',
                  startSeconds: currentTime,
                  suggestedQuality: q
                });
              } else {
                if (player.setPlaybackQualityRange) player.setPlaybackQualityRange(q, q);
                if (player.setPlaybackQuality) player.setPlaybackQuality(q);
                player.seekTo(currentTime, true);
              }
            }
            document.querySelectorAll('#quality-menu .quality-item').forEach(b => {
              b.classList.remove('active');
              b.querySelector('span').innerText = '';
            });
            btn.classList.add('active');
            btn.querySelector('span').innerText = '✓';
            menu.style.display = 'none';
          });

          menu.appendChild(btn);
        });
      } else if (menu.innerHTML.trim() === '') {
        // Fallback if YouTube hasn't returned levels yet
        menu.innerHTML = '<button class="quality-item active" data-quality="auto">Auto <span>✓</span></button>';
      }
    }

    // Popup Menus Logic
    const qualityBtn = document.getElementById('quality-btn');
    const qualityMenu = document.getElementById('quality-menu');
    const speedBtn = document.getElementById('speed-btn');
    const speedMenu = document.getElementById('speed-menu');

    qualityBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speedMenu.style.display = 'none';
      updateQualityMenu();
      qualityMenu.style.display = qualityMenu.style.display === 'flex' ? 'none' : 'flex';
    });

    speedBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      qualityMenu.style.display = 'none';
      speedMenu.style.display = speedMenu.style.display === 'flex' ? 'none' : 'flex';
    });

    document.querySelectorAll('#speed-menu .quality-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const spd = parseFloat(item.getAttribute('data-speed'));
        if (player && player.setPlaybackRate) {
          player.setPlaybackRate(spd);
        }
        document.querySelectorAll('#speed-menu .quality-item').forEach(btn => {
          btn.classList.remove('active');
          btn.querySelector('span').innerText = '';
        });
        item.classList.add('active');
        item.querySelector('span').innerText = '✓';
        document.getElementById('speed-label').innerText = spd + 'x';
        speedMenu.style.display = 'none';
      });
    });

    // Close menus if clicked outside
    document.addEventListener('click', () => {
      qualityMenu.style.display = 'none';
      speedMenu.style.display = 'none';
    });

    // Event Listeners
    document.getElementById('click-shield').addEventListener('click', () => {
      if (!player) return;
      if (isPlaying) player.pauseVideo();
      else player.playVideo();
    });

    document.getElementById('play-pause-btn').addEventListener('click', () => {
      if (!player) return;
      if (isPlaying) player.pauseVideo();
      else player.playVideo();
    });

    document.getElementById('rewind-btn').addEventListener('click', () => {
      if (!player) return;
      player.seekTo(Math.max(0, player.getCurrentTime() - 10), true);
    });

    document.getElementById('forward-btn').addEventListener('click', () => {
      if (!player) return;
      player.seekTo(Math.min(player.getDuration(), player.getCurrentTime() + 10), true);
    });

    const seekBar = document.getElementById('seek-bar');
    seekBar.addEventListener('mousedown', () => isSeeking = true);
    seekBar.addEventListener('input', () => {
      if (!player || !player.getDuration) return;
      const targetTime = (seekBar.value / 100) * player.getDuration();
      document.getElementById('time-display').innerText = formatTime(targetTime) + " / " + formatTime(player.getDuration());
    });
    seekBar.addEventListener('change', () => {
      if (!player || !player.getDuration) return;
      const targetTime = (seekBar.value / 100) * player.getDuration();
      player.seekTo(targetTime, true);
      isSeeking = false;
    });

    const volBar = document.getElementById('vol-bar');
    volBar.addEventListener('input', () => {
      if (!player) return;
      player.setVolume(volBar.value);
      if (volBar.value == 0) player.mute();
      else player.unMute();
    });

    document.getElementById('mute-btn').addEventListener('click', () => {
      if (!player) return;
      if (player.isMuted()) {
        player.unMute();
        volBar.value = player.getVolume() || 100;
      } else {
        player.mute();
        volBar.value = 0;
      }
    });

    document.getElementById('fs-btn').addEventListener('click', () => {
      const elem = document.getElementById('player-container');
      if (!document.fullscreenElement) {
        if (elem.requestFullscreen) elem.requestFullscreen();
        else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)) || (e.ctrlKey && e.keyCode === 85)) {
        e.preventDefault();
        return false;
      }
      if (!player) return;
      // Spacebar toggles play/pause
      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) player.pauseVideo();
        else player.playVideo();
      }
      // Right Arrow: 10 seconds forward
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        player.seekTo(Math.min(player.getDuration(), player.getCurrentTime() + 10), true);
      }
      // Left Arrow: 10 seconds backward
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        player.seekTo(Math.max(0, player.getCurrentTime() - 10), true);
      }
      // 'f' or 'F' toggles fullscreen
      if (e.key === 'f' || e.key === 'F' || e.code === 'KeyF') {
        e.preventDefault();
        const elem = document.getElementById('player-container');
        if (!document.fullscreenElement) {
          if (elem.requestFullscreen) elem.requestFullscreen();
          else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
        } else {
          if (document.exitFullscreen) document.exitFullscreen();
        }
      }
    });
  </script>
</body>
</html>
  `

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
      'X-Frame-Options': 'SAMEORIGIN'
    }
  })
}
