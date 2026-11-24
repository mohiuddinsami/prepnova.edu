'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const contentAdminClient = createClient(
  process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL,
  process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Helper to extract YouTube video ID from various link formats
function extractVideoId(url) {
  if (!url) return null
  const cleanUrl = url.trim()
  const watchMatch = cleanUrl.match(/[?&]v=([^&#]+)/)
  if (watchMatch && watchMatch[1]) return watchMatch[1]
  const shortMatch = cleanUrl.match(/youtu\.be\/([^?&#]+)/)
  if (shortMatch && shortMatch[1]) return shortMatch[1]
  const embedMatch = cleanUrl.match(/youtube\.com\/embed\/([^?&#]+)/)
  if (embedMatch && embedMatch[1]) return embedMatch[1]
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) return cleanUrl
  return null
}

function formatSecondsToDuration(sec) {
  const s = parseInt(sec, 10);
  if (isNaN(s) || s <= 0) return '45m';
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (hours > 0) {
    return `${hours}h ${minutes < 10 ? '0' : ''}${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m${seconds > 0 ? ' ' + seconds + 's' : ''}`;
  }
  return `${seconds}s`;
}

function parseIsoDuration(pt) {
  if (!pt) return null;
  const match = pt.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseInt(match[3] || '0', 10);
  return h * 3600 + m * 60 + s;
}

export async function fetchYouTubeMetadataAction(inputUrl) {
  const video_id = extractVideoId(inputUrl)
  if (!video_id) {
    return { error: 'Invalid YouTube link or ID. Please provide a valid YouTube URL.' }
  }

  const thumbnail_url = `https://img.youtube.com/vi/${video_id}/maxresdefault.jpg`
  let title = `Class Recording (${video_id})`
  let description = ''
  let duration = '45m'

  // Step 1: Try oembed for reliable title
  try {
    const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${video_id}&format=json`)
    if (oembedRes.ok) {
      const data = await oembedRes.json()
      if (data.title) title = data.title
    }
  } catch (err) {}

  // Step 2: Fetch watch page HTML to extract duration, description, and exact metadata
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${video_id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    })
    if (pageRes.ok) {
      const html = await pageRes.text()
      
      // Extract title if oembed didn't get it
      if (title.startsWith('Class Recording')) {
        const titleMatch = html.match(/<meta property="og:title" content="([^"]+)">/) || html.match(/<title>([^<]+)<\/title>/)
        if (titleMatch && titleMatch[1]) title = titleMatch[1].replace(/ - YouTube$/, '')
      }

      // Extract description
      const descMatch = html.match(/<meta property="og:description" content="([^"]*)">/) || html.match(/<meta name="description" content="([^"]*)">/)
      if (descMatch && descMatch[1]) {
        description = descMatch[1]
      }

      // Extract duration reliably
      let seconds = 0;
      const isoMatch = html.match(/<meta itemprop="duration" content="([^"]+)">/i);
      if (isoMatch && isoMatch[1]) {
        seconds = parseIsoDuration(isoMatch[1]);
      }
      if (!seconds) {
        // Look specifically for videoDetails lengthSeconds
        const vdMatch = html.match(/"videoDetails":\{[^}]*"lengthSeconds":"(\d+)"/);
        if (vdMatch && vdMatch[1]) {
          seconds = parseInt(vdMatch[1], 10);
        }
      }
      if (!seconds) {
        // Fallback approxDurationMs specifically inside videoDetails or microformat
        const approxMatch = html.match(/"approxDurationMs":"(\d+)"/);
        if (approxMatch && approxMatch[1]) {
          seconds = Math.floor(parseInt(approxMatch[1], 10) / 1000);
        }
      }
      if (!seconds) {
        const lengthMatch = html.match(/"lengthSeconds":"(\d+)"/);
        if (lengthMatch && lengthMatch[1]) {
          seconds = parseInt(lengthMatch[1], 10);
        }
      }
      if (seconds > 0) {
        duration = formatSecondsToDuration(seconds);
      }
    }
  } catch (err) {}

  return { success: true, video_id, title, thumbnail_url, description, duration }
}

export async function addClassPackageAction(data) {
  try {
    const { title, description, subject, duration, required_level, parent_directory, recordings, resources, thumbnail_url } = data

    if (!title || !recordings || recordings.length === 0) {
      return { error: 'Class title and at least one video recording are required.' }
    }

    // Ensure all recordings have valid video IDs and preserve thumbnails
    const processedRecordings = recordings.map(rec => {
      const vid = extractVideoId(rec.video_id || rec.url) || rec.video_id
      return {
        id: rec.id || crypto.randomUUID(),
        title: rec.title || 'Lecture Part',
        video_id: vid,
        duration: rec.duration || '45m',
        thumbnail_url: rec.thumbnail_url || (vid ? `https://img.youtube.com/vi/${vid}/maxresdefault.jpg` : null)
      }
    })

    // Primary thumbnail and duration calculation
    const finalThumb = thumbnail_url || processedRecordings[0]?.thumbnail_url || null
    let totalSecs = 0;
    processedRecordings.forEach(r => {
      let sec = 0;
      const hMatch = r.duration?.match(/(\d+)\s*h/i);
      const mMatch = r.duration?.match(/(\d+)\s*m/i);
      const sMatch = r.duration?.match(/(\d+)\s*s/i);
      if (hMatch) sec += parseInt(hMatch[1], 10) * 3600;
      if (mMatch) sec += parseInt(mMatch[1], 10) * 60;
      if (sMatch) sec += parseInt(sMatch[1], 10);
      totalSecs += sec;
    });
    const summedDuration = totalSecs > 0 ? formatSecondsToDuration(totalSecs) : processedRecordings[0]?.duration || '1h 00m'
    const finalDuration = processedRecordings.length > 1 ? summedDuration : (duration || summedDuration)

    const { data: insertedClass, error } = await supabaseAdmin.from('classes').insert([
      {
        title,
        description: description || '',
        subject: subject || 'General',
        duration: finalDuration,
        required_level: required_level != null ? parseInt(required_level, 10) : 1,
        video_id: `pkg_${crypto.randomUUID().slice(0, 8)}`,
        thumbnail_url: finalThumb,
        recordings: processedRecordings,
        resources: resources || []
      }
    ]).select().single()

    if (error) {
      return { error: `Database insert error: ${error.message}` }
    }

    // Insert pointer into Content DB directory files table
    const targetDir = parent_directory ? parent_directory.trim().replace(/\/+$/, '') : '/root/classes'
    const finalDir = targetDir.startsWith('/') ? targetDir : '/' + targetDir

    const { error: syncError } = await contentAdminClient.from('files').insert({
      name: title,
      type: 'class',
      parent_directory: finalDir,
      reference_id: insertedClass.id
    })

    if (syncError) {
      return { error: `Package saved in User DB, but folder sync failed: ${syncError.message}` }
    }

    revalidatePath('/admin/classes')
    revalidatePath('/dashboard/classes')
    return { success: 'Class Package created successfully!', classItem: insertedClass }
  } catch (err) {
    return { error: `Server error: ${err.message || String(err)}` }
  }
}

export async function updateClassPackageAction(id, data) {
  try {
    const { title, description, subject, duration, required_level, recordings, resources, thumbnail_url } = data

    const processedRecordings = (recordings || []).map(rec => {
      const vid = extractVideoId(rec.video_id || rec.url) || rec.video_id
      return {
        id: rec.id || crypto.randomUUID(),
        title: rec.title || 'Lecture Part',
        video_id: vid,
        duration: rec.duration || '45m',
        thumbnail_url: rec.thumbnail_url || (vid ? `https://img.youtube.com/vi/${vid}/maxresdefault.jpg` : null)
      }
    })

    const finalThumb = thumbnail_url || processedRecordings[0]?.thumbnail_url || null
    let totalSecs = 0;
    processedRecordings.forEach(r => {
      let sec = 0;
      const hMatch = r.duration?.match(/(\d+)\s*h/i);
      const mMatch = r.duration?.match(/(\d+)\s*m/i);
      const sMatch = r.duration?.match(/(\d+)\s*s/i);
      if (hMatch) sec += parseInt(hMatch[1], 10) * 3600;
      if (mMatch) sec += parseInt(mMatch[1], 10) * 60;
      if (sMatch) sec += parseInt(sMatch[1], 10);
      totalSecs += sec;
    });
    const summedDuration = totalSecs > 0 ? formatSecondsToDuration(totalSecs) : processedRecordings[0]?.duration || '1h 00m'
    const finalDuration = processedRecordings.length > 1 ? summedDuration : (duration || summedDuration)

    const { error } = await supabaseAdmin.from('classes').update({
      title,
      description,
      subject,
      duration: finalDuration,
      required_level: required_level != null ? parseInt(required_level, 10) : 1,
      video_id: processedRecordings[0]?.video_id || `pkg_${id.slice(0, 8)}`,
      thumbnail_url: finalThumb,
      recordings: processedRecordings,
      resources: resources || []
    }).eq('id', id)

    if (error) return { error: `Update error: ${error.message}` }

    // Sync title rename to directory tree if needed
    if (title) {
      const { error: syncError } = await contentAdminClient.from('files').update({ name: title }).eq('reference_id', id)
      if (syncError) {
        return { error: `Package updated, but folder sync failed: ${syncError.message}` }
      }
    }

    revalidatePath('/admin/classes')
    revalidatePath('/dashboard/classes')
    return { success: 'Class Package updated successfully!' }
  } catch (err) {
    return { error: `Server error: ${err.message || String(err)}` }
  }
}

export async function deleteClassPackageAction(id) {
  const { error } = await supabaseAdmin.from('classes').delete().eq('id', id)
  if (error) return { error: error.message }

  await contentAdminClient.from('files').delete().eq('reference_id', id)

  revalidatePath('/admin/classes')
  revalidatePath('/dashboard/classes')
  return { success: 'Class Package deleted successfully!' }
}

export async function createFolderAction(name, parentDirectory) {
  if (!name) return { error: 'Folder name required' }
  const targetDir = parentDirectory ? parentDirectory.trim().replace(/\/+$/, '') : '/root/classes'
  const finalDir = targetDir.startsWith('/') ? targetDir : '/' + targetDir

  const { error } = await contentAdminClient.from('files').insert({
    name: name.trim(),
    type: 'folder',
    parent_directory: finalDir
  })

  if (error) return { error: error.message }
  revalidatePath('/admin/classes')
  revalidatePath('/dashboard/classes')
  return { success: 'Folder created!' }
}

export async function deleteFolderAction(folderId, folderPath) {
  // Move children up or delete
  const { error } = await contentAdminClient.from('files').delete().eq('id', folderId)
  if (error) return { error: error.message }
  revalidatePath('/admin/classes')
  revalidatePath('/dashboard/classes')
  return { success: 'Folder deleted!' }
}

export async function fetchResourceTitleAction(inputUrl) {
  if (!inputUrl || !inputUrl.trim()) {
    return { error: 'Please provide a valid resource URL.' }
  }
  const rawUrl = inputUrl.trim()
  
  let formattedUrl = rawUrl
  const driveMatch = rawUrl.match(/(?:drive\.google\.com\/(?:file\/d\/|presentation\/d\/|open\?id=)|docs\.google\.com\/presentation\/d\/)([\w-]+)/i)
  if (driveMatch && driveMatch[1]) {
    formattedUrl = `https://drive.google.com/file/d/${driveMatch[1]}/preview`
  }

  let title = ''
  try {
    const res = await fetch(rawUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    })
    if (res.ok) {
      const html = await res.text()
      const ogTitle = html.match(/<meta property="og:title" content="([^"]+)">/i) || html.match(/<meta name="title" content="([^"]+)">/i)
      const tagTitle = html.match(/<title>([^<]+)<\/title>/i)
      
      if (ogTitle && ogTitle[1]) {
        title = ogTitle[1]
      } else if (tagTitle && tagTitle[1]) {
        title = tagTitle[1]
      }

      if (title) {
        title = title
          .replace(/\s*-\s*Google Drive$/i, '')
          .replace(/\s*-\s*Google Docs$/i, '')
          .replace(/\s*-\s*Google Slides$/i, '')
          .replace(/\s*-\s*Google Sheets$/i, '')
          .trim()
      }
    }
  } catch (err) {
    console.error('Error fetching resource metadata:', err)
  }

  return {
    title: title || (driveMatch ? 'Class Document / Slide Deck' : 'Attached Class Resource'),
    url: formattedUrl
  }
}
