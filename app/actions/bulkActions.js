'use server'

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import sharp from 'sharp'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL,
  process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function processBulkUploadAction(formData) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }
  }

  try {
    const jsonFile = formData.get('json_file');
    if (!jsonFile) return { error: 'No JSON data provided.' };
    
    const jsonString = await jsonFile.text();
    const parsedData = JSON.parse(jsonString);
    const images = formData.getAll('images'); // File objects

    // 1. Upload Images to Storage
    const uploadedUrls = [];
    for (const image of images) {
      const { data, error } = await supabaseAdmin.storage
        .from('question_images')
        .upload(`public/${image.name}`, image, {
          upsert: true
        });

      if (error) {
        return { error: `Failed to upload image ${image.name}: ${error.message}` };
      }
      
      // Get public URL
      const { data: publicUrlData } = supabaseAdmin.storage
        .from('question_images')
        .getPublicUrl(`public/${image.name}`);
        
      uploadedUrls.push({ name: image.name, url: publicUrlData.publicUrl });
    }

    // 2. Transform JSON data and map Image URLs
    const mappedData = parsedData.map(item => {
      const { option_A, option_B, option_C, option_D, image_url, ...rest } = item;
      
      let finalImageUrl = image_url;
      if (image_url) {
         // Replace raw filename with actual Supabase Public URL if it was uploaded
         const matchedImage = uploadedUrls.find(img => img.name === image_url);
         if (matchedImage) {
           finalImageUrl = matchedImage.url;
         }
      }

      const processMultipleImages = (opt) => {
        if (!opt || typeof opt !== 'string') return opt;
        const cleanOpt = opt.trim();
        if (cleanOpt.includes('||')) {
          const parts = cleanOpt.split('||');
          const mappedParts = parts.map((part, idx) => {
            if (idx === 0) return part.trim();
            const matchedImage = uploadedUrls.find(img => img.name === part.trim());
            return matchedImage ? matchedImage.url : part.trim();
          });
          return mappedParts.join(' || ');
        } else {
          const matchedImage = uploadedUrls.find(img => img.name === cleanOpt);
          if (matchedImage) {
            return matchedImage.url;
          }
        }
        return opt;
      };

      return {
        ...rest,
        option_a: processMultipleImages(option_A || item.option_a),
        option_b: processMultipleImages(option_B || item.option_b),
        option_c: processMultipleImages(option_C || item.option_c),
        option_d: processMultipleImages(option_D || item.option_d),
        correct_answer_explanation: processMultipleImages(item.correct_answer_explanation),
        image_url: finalImageUrl
      };
    });

    // 3. Database Upsert
    const { error: dbError } = await supabaseAdmin
      .from('questions')
      .upsert(mappedData, { onConflict: 'qid' });

    if (dbError) {
      return { error: `Database Insert Failed: ${dbError.message}` };
    }

    return { success: true, count: mappedData.length };
  } catch (e) {
    return { error: `Server error: ${e.message}` };
  }
}

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export async function checkExistingQidsAction(incomingQids) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }
  }
  
  if (!incomingQids || incomingQids.length === 0) return { existingQids: [] };

  try {
    const qidChunks = chunkArray(incomingQids, 100);
    let allExistingQids = [];

    await Promise.all(qidChunks.map(async (chunk) => {
      const { data: qidMatches, error: qidError } = await supabaseAdmin
        .from('questions')
        .select('qid')
        .in('qid', chunk);
        
      if (qidError) throw qidError;
      allExistingQids = allExistingQids.concat(qidMatches.map(m => m.qid));
    }));

    return { existingQids: allExistingQids };
  } catch (e) {
    return { error: e.message };
  }
}

export async function calculateImageHashesAction(formData) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }
  }

  try {
    const images = formData.getAll('images');
    const imageHashes = {};

    for (const file of images) {
       const buffer = Buffer.from(await file.arrayBuffer());
       // Use sharp to get raw pixel data (ignores metadata/EXIF)
       const { data: rawPixels } = await sharp(buffer)
         .ensureAlpha()
         .raw()
         .toBuffer({ resolveWithObject: true });
         
       const hash = crypto.createHash('sha256').update(rawPixels).digest('hex');
       imageHashes[file.name] = hash;
    }

    return { imageHashes };
  } catch (e) {
    return { error: `Hash calculation error: ${e.message}` };
  }
}

export async function calculateImageHashesFromUrlsAction(urls) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }
  }

  try {
    const imageHashes = {};

    for (const url of urls) {
       if (!url) continue;
       
       let fetchUrl = url;
       if (!url.startsWith('http')) {
           const { data } = supabaseAdmin.storage.from('question_images').getPublicUrl(`public/${url}`);
           if (data) fetchUrl = data.publicUrl;
       }

       const response = await fetch(fetchUrl);
       if (!response.ok) {
           console.error(`Failed to fetch image from ${fetchUrl}`);
           continue; 
       }
       
       const arrayBuffer = await response.arrayBuffer();
       const buffer = Buffer.from(arrayBuffer);
       
       const { data: rawPixels } = await sharp(buffer)
         .ensureAlpha()
         .raw()
         .toBuffer({ resolveWithObject: true });
         
       const hash = crypto.createHash('sha256').update(rawPixels).digest('hex');
       imageHashes[url] = hash;
    }

    return { imageHashes };
  } catch (e) {
    return { error: `Hash calculation error: ${e.message}` };
  }
}

export async function checkDuplicatesAction(payloadArray) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }
  }
  
  if (!payloadArray || payloadArray.length === 0) return { duplicates: [], existingQids: [] };

  try {
    const subjects = [...new Set(payloadArray.map(p => p.subject_tag).filter(Boolean))];
    const incomingQids = payloadArray.map(p => p.qid).filter(Boolean);
    
    // 1. Check existing QIDs (Warnings)
    let existingQids = [];
    if (incomingQids.length > 0) {
      const qidChunks = chunkArray(incomingQids, 100);
      await Promise.all(qidChunks.map(async (chunk) => {
        const { data: qidMatches, error: qidError } = await supabaseAdmin
          .from('questions')
          .select('qid')
          .in('qid', chunk);
          
        if (qidError) throw qidError;
        existingQids = existingQids.concat(qidMatches.map(m => m.qid));
      }));
    }

    // 2. Check hash duplicates (Errors)
    const duplicates = [];
    
    const optionsHashes = payloadArray.flatMap(p => p.all_options_hashes?.length > 0 ? p.all_options_hashes : [p.options_hash]).filter(Boolean);
    const restructuredHashes = payloadArray.map(p => p.restructured_hash).filter(Boolean);
    const imageHashes = payloadArray.map(p => p.image_hash).filter(Boolean);
    
    let dbQuestions = [];
    if (optionsHashes.length > 0) {
      const chunks = chunkArray(optionsHashes, 100);
      for (const chunk of chunks) {
         let query1 = supabaseAdmin.from('questions').select('qid, options_hash, all_options_hashes, restructured_hash, image_hash, is_restructured_hash').in('options_hash', chunk);
         let query2 = supabaseAdmin.from('questions').select('qid, options_hash, all_options_hashes, restructured_hash, image_hash, is_restructured_hash').overlaps('all_options_hashes', chunk);
         if (subjects.length > 0) {
           query1 = query1.in('subject_tag', subjects);
           query2 = query2.in('subject_tag', subjects);
         }
         const [res1, res2] = await Promise.all([query1, query2]);
         if (res1.error) console.error("Error fetching options_hash chunk:", res1.error);
         if (res2.error) console.error("Error fetching all_options_hashes chunk:", res2.error);
         if (res1.data) dbQuestions = dbQuestions.concat(res1.data);
         if (res2.data) dbQuestions = dbQuestions.concat(res2.data);
      }
    }
    
    if (restructuredHashes.length > 0) {
      const chunks = chunkArray(restructuredHashes, 100);
      for (const chunk of chunks) {
         let query = supabaseAdmin.from('questions').select('qid, options_hash, all_options_hashes, restructured_hash, image_hash, is_restructured_hash').in('restructured_hash', chunk);
         if (subjects.length > 0) query = query.in('subject_tag', subjects);
         const { data, error } = await query;
         if (error) console.error("Error fetching restructured_hash chunk:", error);
         if (data) dbQuestions = dbQuestions.concat(data);
      }
    }
    
    if (imageHashes.length > 0) {
      const chunks = chunkArray(imageHashes, 100);
      for (const chunk of chunks) {
         let query = supabaseAdmin.from('questions').select('qid, options_hash, all_options_hashes, restructured_hash, image_hash, is_restructured_hash').in('image_hash', chunk);
         if (subjects.length > 0) query = query.in('subject_tag', subjects);
         const { data, error } = await query;
         if (error) console.error("Error fetching image_hash chunk:", error);
         if (data) dbQuestions = dbQuestions.concat(data);
      }
    }

    const uniqueDbQs = [];
    const seenQids = new Set();
    for (const q of dbQuestions) {
       if (!seenQids.has(q.qid)) {
          seenQids.add(q.qid);
          uniqueDbQs.push(q);
       }
    }

    payloadArray.forEach(incoming => {
       let matchReason = null;
       const match = uniqueDbQs.find(dbQ => {
          if (!incoming.is_restructured_hash && !dbQ.is_restructured_hash) {
              const incomingHashes = incoming.all_options_hashes?.length > 0 ? incoming.all_options_hashes : [incoming.options_hash];
              const dbHashes = dbQ.all_options_hashes?.length > 0 ? dbQ.all_options_hashes : [dbQ.options_hash];
              if (incomingHashes.some(h => h && dbHashes.includes(h))) {
                matchReason = 'OPTIONS_HASH';
                return true;
              }
          }
          if (incoming.is_restructured_hash && dbQ.is_restructured_hash && incoming.restructured_hash && dbQ.restructured_hash === incoming.restructured_hash) {
              matchReason = 'RESTRUCTURED_HASH';
              return true;
          }
          if (incoming.image_hash && dbQ.image_hash === incoming.image_hash) {
              matchReason = 'IMAGE_HASH';
              return true;
          }
          return false;
       });
       
       if (match && match.qid !== incoming.qid) {
          duplicates.push({ uploadQid: incoming.qid, dbQid: match.qid, reason: matchReason });
       }
    });

    return { duplicates, existingQids };
  } catch (e) {
    return { error: e.message };
  }
}

export async function deleteQuestionAction(qid) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }
  }

  if (!qid) return { error: 'No qid provided' };

  try {
    // 1. Fetch question to find attached images
    const { data: qData } = await supabaseAdmin
      .from('questions')
      .select('image_url, option_a, option_b, option_c, option_d, correct_answer_explanation')
      .eq('qid', qid)
      .single();

    if (qData) {
      const storagePathsToDelete = [];
      const getPath = (s) => {
        const trimmed = s.trim();
        const marker = '/storage/v1/object/public/question_images/';
        if (trimmed.includes(marker)) {
           const path = trimmed.split(marker)[1];
           if (path) storagePathsToDelete.push(decodeURIComponent(path));
        }
      };

      const extractPaths = (str) => {
        if (!str || typeof str !== 'string') return;
        if (str.includes('||')) {
          str.split('||').slice(1).forEach(p => getPath(p));
        } else {
          getPath(str);
        }
      };

      extractPaths(qData.image_url);
      extractPaths(qData.option_a);
      extractPaths(qData.option_b);
      extractPaths(qData.option_c);
      extractPaths(qData.option_d);
      extractPaths(qData.correct_answer_explanation);

      if (storagePathsToDelete.length > 0) {
        // Silently remove images; if it fails, we still proceed to delete the question row
        await supabaseAdmin.storage.from('question_images').remove(storagePathsToDelete);
      }
    }

    // 2. Delete question from DB
    const { error } = await supabaseAdmin
      .from('questions')
      .delete()
      .eq('qid', qid);

    if (error) throw error;
    
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
}

export async function uploadQuestionImageAction(formData) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }
  }

  try {
    const qid = formData.get('qid');
    const imageFile = formData.get('image');
    const oldImageUrl = formData.get('old_image_url');

    if (!qid || !imageFile) {
      return { error: 'Missing qid or image file.' };
    }

    // Determine file extension from the uploaded file
    const originalName = imageFile.name;
    const ext = originalName.split('.').pop().toLowerCase();
    const allowedExts = ['jpg', 'jpeg', 'png', 'svg', 'webp'];
    if (!allowedExts.includes(ext)) {
      return { error: `Invalid file type: .${ext}. Allowed: ${allowedExts.join(', ')}` };
    }

    // Build a clean storage filename: public/{qid}_context_image.{ext}
    const storagePath = `public/${qid}_context_image.${ext}`;

    // 1. Delete old image from storage if it exists
    if (oldImageUrl && typeof oldImageUrl === 'string' && oldImageUrl.length > 0) {
      const marker = '/storage/v1/object/public/question_images/';
      if (oldImageUrl.includes(marker)) {
        const oldPath = decodeURIComponent(oldImageUrl.split(marker)[1]);
        if (oldPath) {
          await supabaseAdmin.storage.from('question_images').remove([oldPath]);
        }
      }
    }

    // 2. Upload new image (upsert to overwrite if same name)
    const { error: uploadError } = await supabaseAdmin.storage
      .from('question_images')
      .upload(storagePath, imageFile, { upsert: true });

    if (uploadError) {
      return { error: `Upload failed: ${uploadError.message}` };
    }

    // 3. Get public URL
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('question_images')
      .getPublicUrl(storagePath);

    const newUrl = publicUrlData.publicUrl;

    // 4. Update the question row in the DB
    const { error: dbError } = await supabaseAdmin
      .from('questions')
      .update({ image_url: newUrl })
      .eq('qid', qid);

    if (dbError) {
      return { error: `DB update failed: ${dbError.message}` };
    }

    return { success: true, newUrl };
  } catch (e) {
    return { error: e.message };
  }
}

export async function fetchQuestionByQidAction(qid) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }
  }

  if (!qid) return { error: 'No qid provided' };

  try {
    const { data, error } = await supabaseAdmin
      .from('questions')
      .select('*')
      .eq('qid', qid)
      .single();

    if (error) throw error;
    return { data };
  } catch (e) {
    return { error: e.message };
  }
}
