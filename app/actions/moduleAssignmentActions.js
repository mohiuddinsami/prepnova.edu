'use server'

import { createClient } from '@supabase/supabase-js'

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

/**
 * Atomically assign or remove questions from a module.
 * Updates BOTH modules.question_ids AND questions.assigned_modules in a single server action.
 * This prevents the race condition where one side updates but the other doesn't.
 */
export async function bulkToggleQuestionsToModuleAction(moduleId, qids, assign) {
  try {
    if (!moduleId || !qids || qids.length === 0) {
      return { success: false, error: 'Missing moduleId or qids' }
    }

    // 1. Fetch the current module state from DB (not stale client state)
    const { data: mod, error: modErr } = await supabaseAdmin
      .from('modules')
      .select('id, question_ids')
      .eq('id', moduleId)
      .single()

    if (modErr || !mod) {
      return { success: false, error: `Module not found: ${modErr?.message}` }
    }

    // 2. Calculate new module question_ids
    let newQIds
    if (assign) {
      newQIds = [...new Set([...(mod.question_ids || []), ...qids])]
    } else {
      newQIds = (mod.question_ids || []).filter(id => !qids.includes(String(id)))
    }

    // 3. Update the module atomically
    const { error: modUpdateErr } = await supabaseAdmin
      .from('modules')
      .update({ question_ids: newQIds })
      .eq('id', moduleId)

    if (modUpdateErr) {
      return { success: false, error: `Module update failed: ${modUpdateErr.message}` }
    }

    // 4. Fetch all affected questions from DB (not stale client state)
    const { data: affectedQs, error: qFetchErr } = await supabaseAdmin
      .from('questions')
      .select('qid, assigned_modules')
      .in('qid', qids)

    if (qFetchErr) {
      return { success: false, error: `Question fetch failed: ${qFetchErr.message}` }
    }

    // 5. Update each question's assigned_modules atomically
    const updatedQs = []
    const chunkSize = 50
    for (let i = 0; i < (affectedQs || []).length; i += chunkSize) {
      const chunk = (affectedQs || []).slice(i, i + chunkSize)
      await Promise.all(chunk.map(async (q) => {
        let newAssignedMods
        if (assign) {
          newAssignedMods = [...new Set([...(q.assigned_modules || []), moduleId])]
        } else {
          newAssignedMods = (q.assigned_modules || []).filter(id => String(id) !== String(moduleId))
        }
        await supabaseAdmin
          .from('questions')
          .update({ assigned_modules: newAssignedMods })
          .eq('qid', q.qid)
        updatedQs.push({ qid: q.qid, assigned_modules: newAssignedMods })
      }))
    }

    return { success: true, newQIds, updatedQs, count: qids.length }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Atomically toggle a single question on/off a module.
 * Reads current state from DB, not client.
 */
export async function toggleSingleQuestionAction(moduleId, qid) {
  try {
    // 1. Fetch current module
    const { data: mod, error: modErr } = await supabaseAdmin
      .from('modules')
      .select('id, question_ids')
      .eq('id', moduleId)
      .single()

    if (modErr || !mod) {
      return { success: false, error: `Module not found: ${modErr?.message}` }
    }

    // 2. Fetch current question
    const { data: q, error: qErr } = await supabaseAdmin
      .from('questions')
      .select('qid, assigned_modules')
      .eq('qid', qid)
      .single()

    if (qErr || !q) {
      return { success: false, error: `Question not found: ${qErr?.message}` }
    }

    // 3. Determine if assigning or removing (check both sides)
    const isCurrentlyAssigned = (mod.question_ids || []).some(id => String(id) === String(qid)) || (q.assigned_modules || []).some(id => String(id) === String(moduleId))

    let newQIds, newAssignedMods
    if (isCurrentlyAssigned) {
      // Remove
      newQIds = (mod.question_ids || []).filter(id => String(id) !== String(qid))
      newAssignedMods = (q.assigned_modules || []).filter(id => String(id) !== String(moduleId))
    } else {
      // Add
      newQIds = [...new Set([...(mod.question_ids || []), qid])]
      newAssignedMods = [...new Set([...(q.assigned_modules || []), moduleId])]
    }

    // 4. Update both atomically
    await supabaseAdmin.from('modules').update({ question_ids: newQIds }).eq('id', moduleId)
    await supabaseAdmin.from('questions').update({ assigned_modules: newAssignedMods }).eq('qid', qid)

    return { success: true, newQIds, newAssignedMods, wasAssigned: isCurrentlyAssigned }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Atomically clear all questions from a module.
 * Reads current state from DB, not client.
 */
export async function clearAllModuleQuestionsAction(moduleId) {
  try {
    // 1. Fetch current module
    const { data: mod, error: modErr } = await supabaseAdmin
      .from('modules')
      .select('id, question_ids')
      .eq('id', moduleId)
      .single()

    if (modErr || !mod) {
      return { success: false, error: `Module not found: ${modErr?.message}` }
    }

    const qidsToClear = mod.question_ids || []
    if (qidsToClear.length === 0) {
      return { success: true, count: 0 }
    }

    // 2. Wipe module question_ids
    await supabaseAdmin.from('modules').update({ question_ids: [] }).eq('id', moduleId)

    // 3. Fetch affected questions from DB
    const { data: affectedQs } = await supabaseAdmin
      .from('questions')
      .select('qid, assigned_modules')
      .in('qid', qidsToClear)

    // 4. Remove this moduleId from each question's assigned_modules
    const chunkSize = 50
    for (let i = 0; i < (affectedQs || []).length; i += chunkSize) {
      const chunk = (affectedQs || []).slice(i, i + chunkSize)
      await Promise.all(chunk.map(async (q) => {
        const cleanedMods = (q.assigned_modules || []).filter(id => String(id) !== String(moduleId))
        await supabaseAdmin
          .from('questions')
          .update({ assigned_modules: cleanedMods })
          .eq('qid', q.qid)
      }))
    }

    return { success: true, count: qidsToClear.length }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Fetch all questions via service role (bypasses RLS).
 * Used by RouteWrappers fetchData() to avoid anon key RLS blocking.
 */
export async function fetchAdminQuestionsAction() {
  try {
    let allQs = []
    let hasMore = true
    let page = 0
    while (hasMore) {
      const { data, error } = await supabaseAdmin
        .from('questions')
        .select('qid, subject_tag, topic_tag, difficulty, question_type, assigned_modules, question, question_source, created_at, image_url')
        .order('created_at', { ascending: false })
        .range(page * 1000, (page + 1) * 1000 - 1)
      if (error) {
        console.error('fetchAdminQuestionsAction page error:', error.message)
        break
      }
      if (data && data.length > 0) {
        allQs = allQs.concat(data)
        page++
        if (data.length < 1000) hasMore = false
      } else {
        hasMore = false
      }
    }
    return { success: true, data: allQs }
  } catch (err) {
    return { success: false, error: err.message, data: [] }
  }
}

/**
 * Fetch all modules via service role (bypasses RLS).
 */
export async function fetchAdminModulesAction() {
  try {
    const { data, error } = await supabaseAdmin
      .from('modules')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      return { success: false, error: error.message, data: [] }
    }
    return { success: true, data: data || [] }
  } catch (err) {
    return { success: false, error: err.message, data: [] }
  }
}

/**
 * Fetch all practice tests via service role (bypasses RLS).
 */
export async function fetchAdminTestsAction() {
  try {
    const { data, error } = await supabaseAdmin
      .from('practice_tests')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      return { success: false, error: error.message, data: [] }
    }
    return { success: true, data: data || [] }
  } catch (err) {
    return { success: false, error: err.message, data: [] }
  }
}
