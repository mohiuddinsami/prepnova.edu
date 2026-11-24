'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/utils/supabase/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const contentAdminClient = createClient(
  process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL || '',
  process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

/**
 * Calculates the expected difficulty contribution (y) on the 400-1600 scale based on attempt state and student proficiency X.
 * @param {number} state - Attempt state (< 0 for unsolved failure counts, > 0 for solved on try N)
 * @param {number} X - Student SAT score estimate (0 if unrated)
 * @returns {number} y contribution value (0 or clamped between 400 and 1600)
 */
function calculateExpectedRating(state, X) {
  if (!X || X <= 0) return 0

  const clampedX = Math.max(400, Math.min(1600, X))

  if (state === 1) {
    return Math.max(400, Math.min(1600, clampedX - 200))
  } else if (state === 2) {
    return Math.max(400, Math.min(1600, clampedX))
  } else if (state === 3) {
    return Math.max(400, Math.min(1600, clampedX + 200))
  } else {
    // state < 0 (unsolved failure count) or state >= 4
    return Math.max(400, Math.min(1600, clampedX + 400))
  }
}

/**
 * Derives student proficiency X on the official 400-1600 scale from section scores stored in 0-800 format.
 */
function deriveScaledProficiencyX(satRW, satMath, subjectTag) {
  let X = 0
  if (subjectTag === 'READING_WRITING') {
    X = satRW > 0 ? satRW * 2 : (satMath > 0 ? satMath * 2 : 0)
  } else if (subjectTag === 'MATH') {
    X = satMath > 0 ? satMath * 2 : (satRW > 0 ? satRW * 2 : 0)
  } else {
    if (satRW > 0 && satMath > 0) {
      X = satRW + satMath
    } else if (satRW > 0) {
      X = satRW * 2
    } else if (satMath > 0) {
      X = satMath * 2
    }
  }
  if (X > 0 && X < 950) {
    return 0 // Treat scores below 950 exactly as unrated (X = 0)
  }
  if (X > 0 && (X < 400 || X > 1600)) {
    X = Math.max(400, Math.min(1600, X))
  }
  return X
}

/**
 * Records a student's answer attempt for a specific question (O(1) calculation and delta update).
 * @param {Object} params
 * @param {string} params.qid - Question ID
 * @param {boolean} params.isCorrect - Whether the student answered correctly on this attempt
 * @param {string} [params.subjectTag] - Subject category ('READING_WRITING' or 'MATH')
 * @returns {Promise<{success: boolean, status?: string, error?: string}>}
 */
export async function recordItemAttemptO1Action({ qid, isCorrect, subjectTag }) {
  try {
    if (!qid) return { success: false, error: 'Missing question ID' }

    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // 1. Fetch user profile from User DB
    const { data: profile, error: profError } = await supabaseAdmin
      .from('profiles')
      .select('latest_sat_rw, latest_sat_math, question_attempts')
      .eq('id', user.id)
      .single()

    if (profError && profError.code !== 'PGRST116') {
      console.error('Error fetching profile for difficulty engine:', profError)
    }

    // 2. Determine proficiency X scaled to 400-1600 from 0-800 section format
    const satRW = Number(profile?.latest_sat_rw || 0)
    const satMath = Number(profile?.latest_sat_math || 0)
    const X = deriveScaledProficiencyX(satRW, satMath, subjectTag)

    // 3. Inspect existing attempt state from profiles.question_attempts JSONB
    const questionAttempts = profile?.question_attempts || {}
    const existingEntry = questionAttempts[qid]
    const [prevState, prevY] = Array.isArray(existingEntry)
      ? existingEntry
      : [0, 0]

    // 4. Check Once-Solved Lock (if attempt_state > 0, locked forever!)
    if (prevState > 0) {
      return { success: true, status: 'locked', qid }
    }

    // 5. Compute newState and yNew
    let newState = 0
    if (isCorrect === false) {
      newState = prevState < 0 ? prevState - 1 : -1
    } else {
      newState = prevState < 0 ? Math.abs(prevState) + 1 : 1
    }

    const yNew = calculateExpectedRating(newState, X)

    // Check if delta update is a no-op (same state or same contribution, e.g. failing again when rated with same X or failing when unrated)
    if (prevState < 0 && yNew === prevY && (X === 0 || prevY > 0)) {
      // Still need to update newState failure count in User DB, but Content DB requires no delta transaction
      const updatedAttempts = { ...questionAttempts, [qid]: [newState, yNew] }
      await supabaseAdmin
        .from('profiles')
        .update({ question_attempts: updatedAttempts })
        .eq('id', user.id)

      return { success: true, status: 'noop_global', qid, newState, yNew }
    }

    // 6. Update user profile in User DB
    const updatedAttempts = { ...questionAttempts, [qid]: [newState, yNew] }
    const { error: updateProfError } = await supabaseAdmin
      .from('profiles')
      .update({ question_attempts: updatedAttempts })
      .eq('id', user.id)

    if (updateProfError) {
      console.error('Failed to update question_attempts on profile:', updateProfError)
    }

    // 7. Update global item telemetry in Content DB (questions table)
    const { data: qRow, error: qFetchError } = await contentAdminClient
      .from('questions')
      .select('attendee_count, unrated_attendee_count, sum_of_expected_ratings, difficulty_rating')
      .eq('qid', qid)
      .single()

    if (qFetchError || !qRow) {
      // Question might not exist yet in questions table or error reading
      return { success: true, status: 'question_not_found_or_updated_user_only', qid, newState, yNew }
    }

    let attendeeCount = Number(qRow.attendee_count || 0)
    let unratedCount = Number(qRow.unrated_attendee_count || 0)
    let sumRatings = Number(qRow.sum_of_expected_ratings || 0)

    if (X === 0) {
      // Unrated student
      if (prevState === 0) {
        unratedCount += 1
      }
      // sumRatings untouched (+0)
    } else {
      // Rated student (X in [400, 1600])
      if (prevState === 0) {
        // First time seeing the item, directly rated
        attendeeCount += 1
        sumRatings += yNew
      } else if (prevState < 0 && prevY === 0) {
        // Was unrated when initially failing, but now has an SAT score X > 0 (Promotion!)
        unratedCount = Math.max(0, unratedCount - 1)
        attendeeCount += 1
        sumRatings += yNew
      } else {
        // Was already rated on previous fail, now applying delta (Delta = yNew - prevY)
        const delta = yNew - prevY
        sumRatings += delta
      }
    }

    const difficultyRating = attendeeCount > 0 ? Math.round(sumRatings / attendeeCount) : null

    const { error: updateQError } = await contentAdminClient
      .from('questions')
      .update({
        attendee_count: attendeeCount,
        unrated_attendee_count: unratedCount,
        sum_of_expected_ratings: sumRatings,
        difficulty_rating: difficultyRating
      })
      .eq('qid', qid)

    if (updateQError) {
      console.error('Failed to update global question difficulty:', updateQError)
      return { success: false, error: 'Content DB update error: ' + updateQError.message }
    }

    return {
      success: true,
      status: 'updated',
      qid,
      newState,
      yNew,
      attendeeCount,
      unratedCount,
      difficultyRating
    }
  } catch (err) {
    console.error('Error in recordItemAttemptO1Action:', err)
    return { success: false, error: err.message || 'Server error' }
  }
}

/**
 * Atomically records multiple item attempts for a user submission, preventing read-modify-write race conditions on profiles.question_attempts.
 * @param {Object} params
 * @param {Array<{qid: string, isCorrect: boolean, subjectTag?: string}>} params.attempts
 * @returns {Promise<{success: boolean, processedCount: number, error?: string}>}
 */
export async function recordBatchAttemptsO1Action({ attempts }) {
  try {
    if (!Array.isArray(attempts) || attempts.length === 0) {
      return { success: true, processedCount: 0 }
    }

    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // 1. Fetch user profile from User DB ONCE for the entire batch
    const { data: profile, error: profError } = await supabaseAdmin
      .from('profiles')
      .select('latest_sat_rw, latest_sat_math, question_attempts')
      .eq('id', user.id)
      .single()

    if (profError && profError.code !== 'PGRST116') {
      console.error('Error fetching profile for batch difficulty engine:', profError)
    }

    const satRW = Number(profile?.latest_sat_rw || 0)
    const satMath = Number(profile?.latest_sat_math || 0)
    const updatedAttempts = { ...(profile?.question_attempts || {}) }
    const contentUpdates = []

    // 2. Process each attempted question sequentially in memory
    for (const item of attempts) {
      const { qid, isCorrect, subjectTag } = item
      if (!qid) continue

      const X = deriveScaledProficiencyX(satRW, satMath, subjectTag)

      const existingEntry = updatedAttempts[qid]
      const [prevState, prevY] = Array.isArray(existingEntry) ? existingEntry : [0, 0]

      // Check Once-Solved Lock
      if (prevState > 0) continue

      let newState = 0
      if (isCorrect === false) {
        newState = prevState < 0 ? prevState - 1 : -1
      } else {
        newState = prevState < 0 ? Math.abs(prevState) + 1 : 1
      }

      const yNew = calculateExpectedRating(newState, X)

      // Check no-op for global rating pool
      if (prevState < 0 && yNew === prevY && (X === 0 || prevY > 0)) {
        updatedAttempts[qid] = [newState, yNew]
        continue
      }

      updatedAttempts[qid] = [newState, yNew]
      contentUpdates.push({ qid, prevState, prevY, newState, yNew, X })
    }

    // 3. Atomically save the merged question_attempts back to User DB ONCE
    const { error: updateProfError } = await supabaseAdmin
      .from('profiles')
      .update({ question_attempts: updatedAttempts })
      .eq('id', user.id)

    if (updateProfError) {
      console.error('Failed to update batch question_attempts on profile:', updateProfError)
    }

    // 4. Process global Content DB telemetry updates sequentially or concurrently across unique items
    for (const update of contentUpdates) {
      const { qid, prevState, prevY, yNew, X } = update
      const { data: qRow, error: qFetchError } = await contentAdminClient
        .from('questions')
        .select('attendee_count, unrated_attendee_count, sum_of_expected_ratings, difficulty_rating')
        .eq('qid', qid)
        .single()

      if (qFetchError || !qRow) continue

      let attendeeCount = Number(qRow.attendee_count || 0)
      let unratedCount = Number(qRow.unrated_attendee_count || 0)
      let sumRatings = Number(qRow.sum_of_expected_ratings || 0)

      if (X === 0) {
        if (prevState === 0) {
          unratedCount += 1
        }
      } else {
        if (prevState === 0) {
          attendeeCount += 1
          sumRatings += yNew
        } else if (prevState < 0 && prevY === 0) {
          unratedCount = Math.max(0, unratedCount - 1)
          attendeeCount += 1
          sumRatings += yNew
        } else {
          const delta = yNew - prevY
          sumRatings += delta
        }
      }

      const difficultyRating = attendeeCount > 0 ? Math.round(sumRatings / attendeeCount) : null

      await contentAdminClient
        .from('questions')
        .update({
          attendee_count: attendeeCount,
          unrated_attendee_count: unratedCount,
          sum_of_expected_ratings: sumRatings,
          difficulty_rating: difficultyRating
        })
        .eq('qid', qid)
    }

    return { success: true, processedCount: attempts.length }
  } catch (err) {
    console.error('Error in recordBatchAttemptsO1Action:', err)
    return { success: false, error: err.message || 'Server error' }
  }
}
