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

export async function fetchTotalQuestionsCountAction() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }
  }

  try {
    const { count, error } = await supabaseAdmin
      .from('questions')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return { count };
  } catch (e) {
    return { error: e.message };
  }
}

export async function fetchQuestionsBatchAction(offset, limit = 50) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }
  }

  try {
    // Sort by created_at to ensure consistent pagination
    const { data, error } = await supabaseAdmin
      .from('questions')
      .select('qid, subject_tag, topic_tag, question_type, option_a, option_b, option_c, option_d, correct_answer, image_url, context, question, options_hash, all_options_hashes, image_hash, is_restructured_hash, restructured_hash')
      .order('created_at', { ascending: true })
      .order('qid', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { data };
  } catch (e) {
    return { error: e.message };
  }
}

export async function fetchLatestQuestionsAction(limit = 15) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('questions')
      .select('qid, subject_tag, topic_tag, question_type, option_a, option_b, option_c, option_d, correct_answer, image_url, context, question, options_hash, all_options_hashes, image_hash, is_restructured_hash, restructured_hash')
      .like('qid', 'junk%')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { data };
  } catch (e) {
    return { error: e.message };
  }
}

export async function fetchRestructuredQuestionsAction() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('questions')
      .select('qid, subject_tag, topic_tag, question_type, option_a, option_b, option_c, option_d, correct_answer, image_url, context, question, options_hash, all_options_hashes, image_hash, is_restructured_hash, restructured_hash')
      .eq('is_restructured_hash', true);

    if (error) throw error;
    return { data };
  } catch (e) {
    return { error: e.message };
  }
}

export async function calculateSingleImageHashAction(url) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }
  }
  if (!url) return { hash: null };

  try {
    let fetchUrl = url;
    if (!url.startsWith('http')) {
      const { data } = supabaseAdmin.storage.from('question_images').getPublicUrl(`public/${url}`);
      if (data) fetchUrl = data.publicUrl;
    }

    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from ${fetchUrl}: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data: rawPixels } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const hash = crypto.createHash('sha256').update(rawPixels).digest('hex');
    return { hash };
  } catch (e) {
    return { error: `Hash calculation error: ${e.message}` };
  }
}

export async function resolveDuplicateAction(type, qidToModify, newOptionsHash, newImageHash) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }
  }
  
  try {
    if (type === 'DELETE') {
      const { error } = await supabaseAdmin.from('questions').delete().eq('qid', qidToModify);
      if (error) throw error;
      return { success: true, message: `Deleted ${qidToModify}` };
    } 
    else if (type === 'RESTRUCTURE') {
      const { error } = await supabaseAdmin.from('questions').update({
        is_restructured_hash: true,
        restructured_hash: newOptionsHash,
        image_hash: newImageHash
      }).eq('qid', qidToModify);
      
      if (error) throw error;
      return { success: true, message: `Restructured ${qidToModify}` };
    }
    
    return { error: 'Unknown resolution type' };
  } catch (e) {
    return { error: e.message };
  }
}

export async function bulkUpdateHashesAction(updates) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }
  }
  
  if (!updates || updates.length === 0) return { success: true, count: 0 };

  try {
    // updates is an array of objects: { qid, options_hash, image_hash, is_restructured_hash, restructured_hash }
    // Using upsert with only the fields we want to update and qid as conflict target
    
    // NOTE: Upserting partial data might overwrite omitted fields with null if not careful.
    // However, Supabase upsert will only update the provided columns if we use ignoreDuplicates=false, 
    // but we need to provide all non-null columns if they don't have defaults.
    
    // A safer way for partial updates in bulk is Promise.all on single updates, or chunked Promise.all.
    // Since we batch in 50s, Promise.all on .update() is perfectly safe and won't hit limits.
    
    const results = await Promise.all(updates.map(update => {
      const { qid, options_hash, all_options_hashes, image_hash, is_restructured_hash, restructured_hash } = update;
      return supabaseAdmin.from('questions').update({
        options_hash,
        all_options_hashes,
        restructured_hash,
        image_hash,
        is_restructured_hash
      }).eq('qid', qid);
    }));

    const errors = results.filter(r => r.error).map(r => r.error.message);
    if (errors.length > 0) {
      return { error: `Failed to update ${errors.length} questions. First error: ${errors[0]}` };
    }
    
    console.log(`[Rehasher] Successfully updated ${updates.length} hashes in the database.`);
    return { success: true, count: updates.length };
  } catch (e) {
    return { error: e.message };
  }
}

export async function uploadTestImagesAction(formData) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set' };
  }

  try {
    const files = formData.getAll('images');
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error } = await supabaseAdmin.storage
        .from('question_images')
        .upload(`public/${file.name}`, buffer, { 
          contentType: file.type || 'image/svg+xml', 
          upsert: true 
        });
      
      if (error) throw error;
    }
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
}
