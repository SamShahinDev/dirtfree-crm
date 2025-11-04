'use server'

import { z } from 'zod'
import { getServerSupabase } from '@/lib/supabase/server'
import { makeTechnicianAction, makeDispatcherAction } from '@/lib/actions'

// Types for board data
export interface ThreadSummary {
  id: string
  title: string
  status: 'open' | 'acknowledged' | 'resolved'
  postCount: number
  lastActivity: string | null
  urgentCount: number
  createdBy: string
  createdByName: string | null
  createdAt: string
}

export interface ThreadDetail {
  id: string
  truckId: string
  title: string
  status: 'open' | 'acknowledged' | 'resolved'
  createdBy: string
  createdByName: string | null
  createdAt: string
  updatedAt: string
}

export interface PostDetail {
  id: string
  threadId: string
  kind: 'need' | 'issue' | 'note' | 'update'
  body: string
  photoKey: string | null
  imageUrls: string[] | null
  urgent: boolean
  status: 'open' | 'acknowledged' | 'resolved'
  createdBy: string
  createdByName: string | null
  createdAt: string
  updatedAt: string
  reminderId: string | null
}

/**
 * Check if user has access to a truck
 */
export const checkAccess = makeTechnicianAction(
  z.object({ truckId: z.string().uuid() }),
  async ({ truckId }, { user, role }): Promise<{ hasAccess: boolean }> => {
    // Admin and dispatcher have access to all trucks
    if (role === 'admin' || role === 'dispatcher') {
      return { hasAccess: true }
    }

    const supabase = await getServerSupabase()

    try {
      const { data, error } = await supabase
        .from('truck_assignments')
        .select('id')
        .eq('truck_id', truckId)
        .eq('user_id', user.id)
        .limit(1)

      if (error) {
        console.error('Error checking truck access:', error)
        // If truck_assignments table doesn't exist, allow access for now
        if (error.message.includes('does not exist')) {
          console.warn('truck_assignments table does not exist, allowing access')
          return { hasAccess: true }
        }
        return { hasAccess: false }
      }

      return { hasAccess: data && data.length > 0 }
    } catch (error) {
      console.error('Error checking truck access:', error)
      return { hasAccess: false }
    }
  }
)

/**
 * List threads for a truck
 */
export const listThreads = makeTechnicianAction(
  z.object({
    truckId: z.string().uuid(),
    status: z.enum(['open', 'acknowledged', 'resolved']).optional()
  }),
  async ({ truckId, status }, { user, role }): Promise<ThreadSummary[]> => {
    try {
      console.log('[Vehicle Board] Listing threads with truck ID validation:', {
        truckId,
        truckIdType: typeof truckId,
        truckIdLength: truckId ? truckId.length : 0,
        isValidUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(truckId || ''),
        statusFilter: status || 'none',
        user: { id: user.id, role }
      })

      // Validate truck ID
      if (!truckId || truckId === 'undefined' || truckId === 'null') {
        console.error('[Vehicle Board] Invalid truck ID provided for listing:', truckId)
        return []
      }

      const supabase = await getServerSupabase()

      // Check if supabase client is properly initialized
      if (!supabase || typeof supabase.from !== 'function') {
        console.error('[Vehicle Board] Supabase client not properly initialized')
        return []
      }

      console.log('[Vehicle Board] Supabase client initialized, building query')

      // Query truck_threads directly without the view for better debugging
      let query = supabase
        .from('truck_threads')
        .select('*')
        .eq('truck_id', truckId)
        .order('updated_at', { ascending: false })

      if (status) {
        query = query.eq('status', status)
      }

      console.log('[Vehicle Board] Executing query on truck_threads table with truck_id:', truckId)

      const { data, error } = await query

      if (error) {
        console.error('[Vehicle Board] Error fetching threads:', {
          error,
          code: error?.code,
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          queryTruckId: truckId
        })

        // Handle missing table/view gracefully
        if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
          console.warn('[Vehicle Board] Thread tables/views do not exist, returning empty array:', error.message)
          return []
        }
        throw new Error(`Failed to fetch threads: ${error.message}`)
      }

      console.log('[Vehicle Board] Query completed successfully:', {
        queryTruckId: truckId,
        resultCount: data?.length || 0,
        hasResults: !!(data && data.length > 0),
        firstThreadId: data && data.length > 0 ? data[0].id : null,
        allThreadTruckIds: data ? data.map(t => t.truck_id) : [],
        threads: data || []
      })

      return (data || []).map(thread => ({
        id: thread.id,
        title: thread.title,
        status: thread.status,
        postCount: 0, // Will be calculated separately if needed
        lastActivity: thread.updated_at,
        urgentCount: 0, // Will be calculated separately if needed
        createdBy: thread.created_by,
        createdByName: null, // No user name since we're not joining users table
        createdAt: thread.created_at
      }))
    } catch (error) {
      console.error('[Vehicle Board] Error fetching threads:', error)
      // Return empty array instead of throwing for missing tables
      if (error instanceof Error && (
        error.message.includes('does not exist') ||
        error.message.includes('schema cache') ||
        error.message.includes('supabase.from is not a function')
      )) {
        console.warn('[Vehicle Board] Returning empty threads array due to missing database setup')
        return []
      }
      throw new Error('Failed to fetch threads')
    }
  }
)

/**
 * Get thread details with posts
 */
export const getThread = makeTechnicianAction(
  z.object({ threadId: z.string().uuid() }),
  async ({ threadId }, { user, role }): Promise<{
    thread: ThreadDetail
    posts: PostDetail[]
  } | null> => {
    const supabase = await getServerSupabase()

    try {
      console.log('[Vehicle Board] Fetching thread details for:', threadId)

      // Get thread details without user join (users table might not exist)
      const { data: threadData, error: threadError } = await supabase
        .from('truck_threads')
        .select(`
          id,
          truck_id,
          title,
          status,
          created_by,
          created_at,
          updated_at
        `)
        .eq('id', threadId)
        .single()

      if (threadError) {
        console.error('[Vehicle Board] Error fetching thread:', {
          error: threadError,
          code: threadError?.code,
          message: threadError?.message,
          details: threadError?.details,
          hint: threadError?.hint
        })

        if (threadError.code === 'PGRST116') {
          console.log('[Vehicle Board] Thread not found:', threadId)
          return null
        }

        if (threadError.message.includes('does not exist')) {
          console.warn('[Vehicle Board] Thread table does not exist')
          return null
        }

        throw new Error(`Failed to fetch thread: ${threadError.message}`)
      }

      if (!threadData) {
        console.log('[Vehicle Board] Thread not found:', threadId)
        return null
      }

      console.log('[Vehicle Board] Thread found:', threadData)

      // Get posts for the thread without user join
      const { data: postsData, error: postsError } = await supabase
        .from('truck_posts')
        .select(`
          id,
          thread_id,
          kind,
          body,
          photo_key,
          image_urls,
          urgent,
          status,
          created_by,
          created_at,
          updated_at,
          reminder_id
        `)
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })

      if (postsError) {
        console.error('[Vehicle Board] Error fetching posts:', {
          error: postsError,
          code: postsError?.code,
          message: postsError?.message,
          details: postsError?.details,
          hint: postsError?.hint
        })
      }

      console.log('[Vehicle Board] Posts fetched:', {
        count: postsData?.length || 0,
        posts: postsData || []
      })

      const thread: ThreadDetail = {
        id: threadData.id,
        truckId: threadData.truck_id,
        title: threadData.title,
        status: threadData.status,
        createdBy: threadData.created_by,
        createdByName: null, // No user name since we're not joining users table
        createdAt: threadData.created_at,
        updatedAt: threadData.updated_at
      }

      const posts: PostDetail[] = (postsData || []).map(post => ({
        id: post.id,
        threadId: post.thread_id,
        kind: post.kind,
        body: post.body,
        photoKey: post.photo_key,
        imageUrls: post.image_urls,
        urgent: post.urgent,
        status: post.status,
        createdBy: post.created_by,
        createdByName: null, // No user name since we're not joining users table
        createdAt: post.created_at,
        updatedAt: post.updated_at,
        reminderId: post.reminder_id
      }))

      console.log('[Vehicle Board] Thread details prepared successfully')

      return { thread, posts }
    } catch (error) {
      console.error('[Vehicle Board] Error fetching thread:', error)
      throw new Error('Failed to fetch thread')
    }
  }
)

/**
 * Create a new thread with first post
 */
export const createThread = makeTechnicianAction(
  z.object({
    truckId: z.string().uuid(),
    title: z.string().min(1).max(200),
    firstPost: z.object({
      kind: z.enum(['need', 'issue', 'note', 'update']),
      body: z.string().min(1).max(2000),
      urgent: z.boolean().optional().default(false),
      photoKey: z.string().optional(),
      imageUrls: z.array(z.string().url()).max(3).optional()
    })
  }),
  async ({ truckId, title, firstPost }, { user, role }): Promise<{ threadId: string; postId: string }> => {
    try {
      console.log('[Vehicle Board] Starting thread creation with truck ID validation:', {
        truckId,
        truckIdType: typeof truckId,
        truckIdLength: truckId ? truckId.length : 0,
        isValidUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(truckId || ''),
        title,
        firstPost,
        user: { id: user.id, role },
        timestamp: new Date().toISOString()
      })

      // Validate truck ID
      if (!truckId || truckId === 'undefined' || truckId === 'null') {
        console.error('[Vehicle Board] Invalid truck ID provided:', truckId)
        throw new Error('Invalid truck ID provided')
      }

      const supabase = await getServerSupabase()

      // Check if supabase client is properly initialized
      if (!supabase || typeof supabase.from !== 'function') {
        console.error('[Vehicle Board] Supabase client not properly initialized')
        throw new Error('Database connection error. Please try again.')
      }

      console.log('[Vehicle Board] Supabase client initialized successfully')

      // Prepare thread data
      const threadData = {
        truck_id: truckId,
        title,
        created_by: user.id,
        status: 'open'
      }

      console.log('[Vehicle Board] Thread data prepared for insertion:', {
        threadData,
        truckIdInData: threadData.truck_id,
        truckIdMatch: threadData.truck_id === truckId,
        dataValidation: {
          hasTruckId: !!threadData.truck_id,
          hasTitle: !!threadData.title,
          hasCreatedBy: !!threadData.created_by,
          hasStatus: !!threadData.status
        }
      })

      // Create the thread
      const { data: threadResult, error: threadError } = await supabase
        .from('truck_threads')
        .insert(threadData)
        .select('id')
        .single()

      if (threadError || !threadResult) {
        console.error('[Vehicle Board] Thread creation error:', {
          error: threadError,
          code: threadError?.code,
          message: threadError?.message,
          details: threadError?.details,
          hint: threadError?.hint,
          data: threadResult
        })

        // Handle missing table gracefully
        if (threadError?.message.includes('does not exist') || threadError?.message.includes('schema cache')) {
          throw new Error('Vehicle Board feature is not yet available. Database tables need to be set up.')
        }
        throw new Error(`Failed to create thread: ${threadError?.message}`)
      }

      console.log('[Vehicle Board] Thread created successfully:', threadResult)

      const threadId = threadResult.id

      // Prepare post data
      const postData = {
        thread_id: threadId,
        kind: firstPost.kind,
        body: firstPost.body,
        photo_key: firstPost.photoKey || null,
        image_urls: firstPost.imageUrls || null,
        urgent: firstPost.urgent && (firstPost.kind === 'need' || firstPost.kind === 'issue'),
        created_by: user.id,
        status: 'open'
      }

      console.log('[Vehicle Board] Creating first post with data:', postData)

      const { data: postResult, error: postError } = await supabase
        .from('truck_posts')
        .insert(postData)
        .select('id, urgent, kind')
        .single()

      if (postError || !postResult) {
        console.error('[Vehicle Board] Post creation error:', {
          error: postError,
          code: postError?.code,
          message: postError?.message,
          details: postError?.details,
          hint: postError?.hint,
          data: postResult
        })
        throw new Error(`Failed to create post: ${postError?.message}`)
      }

      console.log('[Vehicle Board] Post created successfully:', postResult)

      const postId = postResult.id

      // Create reminder if urgent need/issue
      if (postData.urgent && (postData.kind === 'need' || postData.kind === 'issue')) {
        try {
          // Get truck info for reminder
          const { data: truckData } = await supabase
            .from('trucks')
            .select('number, name')
            .eq('id', truckId)
            .single()

          if (truckData) {
            const vehicleLabel = truckData.name
              ? `Truck #${truckData.number} (${truckData.name})`
              : `Truck #${truckData.number}`

            const { data: reminderData, error: reminderError } = await supabase
              .from('reminders')
              .insert({
                type: 'follow_up',
                title: `${vehicleLabel} urgent ${postData.kind}`,
                body: `Urgent ${postData.kind} reported in Vehicle Board: ${title}`,
                customer_id: null,
                job_id: null,
                scheduled_date: new Date().toISOString().split('T')[0],
                status: 'pending'
              })
              .select('id')
              .single()

            if (!reminderError && reminderData) {
              // Link the reminder to the post
              await supabase
                .from('truck_posts')
                .update({ reminder_id: reminderData.id })
                .eq('id', postId)

              // Audit the reminder creation
              await supabase
                .from('audit_logs')
                .insert({
                  action: 'create_reminder_from_truck_post',
                  entity: 'reminder',
                  entity_id: reminderData.id,
                  meta: {
                    truck_id: truckId,
                    thread_id: threadId,
                    post_id: postId,
                    post_kind: postData.kind
                  }
                })
            }
          }
        } catch (reminderError) {
          console.error('Failed to create reminder:', reminderError)
          // Don't fail the whole operation if reminder creation fails
        }
      }

      // Audit thread creation
      await supabase
        .from('audit_logs')
        .insert({
          action: 'create_truck_thread',
          entity: 'truck_thread',
          entity_id: threadId,
          meta: {
            truck_id: truckId,
            title: title.substring(0, 100),
            first_post_kind: firstPost.kind,
            urgent: postData.urgent
          }
        })

      return { threadId, postId }
    } catch (error) {
      console.error('Error creating thread:', error)
      // Handle specific error types gracefully
      if (error instanceof Error) {
        if (error.message.includes('does not exist') ||
            error.message.includes('schema cache') ||
            error.message.includes('Database connection error') ||
            error.message.includes('Vehicle Board feature is not yet available')) {
          throw error // Re-throw with the specific error message
        }
        if (error.message.includes('supabase.from is not a function')) {
          throw new Error('Database connection error. Please try again.')
        }
      }
      throw new Error('Failed to create thread')
    }
  }
)

/**
 * Create a new post in an existing thread
 */
export const createPost = makeTechnicianAction(
  z.object({
    threadId: z.string().uuid(),
    kind: z.enum(['need', 'issue', 'note', 'update']),
    body: z.string().min(1).max(2000),
    urgent: z.boolean().optional().default(false),
    photoKey: z.string().optional(),
    imageUrls: z.array(z.string().url()).max(3).optional()
  }),
  async ({ threadId, kind, body, urgent, photoKey, imageUrls }, { user, role }): Promise<{ postId: string }> => {
    const supabase = await getServerSupabase()

    try {
      // Create the post
      const { data: postData, error: postError } = await supabase
        .from('truck_posts')
        .insert({
          thread_id: threadId,
          kind,
          body,
          photo_key: photoKey || null,
          image_urls: imageUrls || null,
          urgent: urgent && (kind === 'need' || kind === 'issue'),
          created_by: user.id,
          status: 'open'
        })
        .select('id, urgent, kind')
        .single()

      if (postError || !postData) {
        throw new Error(`Failed to create post: ${postError?.message}`)
      }

      const postId = postData.id

      // Create reminder if urgent and no existing reminder
      if (postData.urgent && (postData.kind === 'need' || postData.kind === 'issue')) {
        try {
          // Get thread and truck info
          const { data: threadData } = await supabase
            .from('truck_threads')
            .select('truck_id, title, trucks(number, name)')
            .eq('id', threadId)
            .single()

          if (threadData?.trucks) {
            const truck = threadData.trucks
            const vehicleLabel = truck.name
              ? `Truck #${truck.number} (${truck.name})`
              : `Truck #${truck.number}`

            // Check if an open reminder already exists for this thread
            const { data: existingReminder } = await supabase
              .from('truck_posts')
              .select('reminder_id')
              .eq('thread_id', threadId)
              .not('reminder_id', 'is', null)
              .limit(1)

            if (!existingReminder || existingReminder.length === 0) {
              const { data: reminderData, error: reminderError } = await supabase
                .from('reminders')
                .insert({
                  type: 'follow_up',
                  title: `${vehicleLabel} urgent ${postData.kind}`,
                  body: `Urgent ${postData.kind} reported in Vehicle Board: ${threadData.title}`,
                  customer_id: null,
                  job_id: null,
                  scheduled_date: new Date().toISOString().split('T')[0],
                  status: 'pending'
                })
                .select('id')
                .single()

              if (!reminderError && reminderData) {
                // Link the reminder to the post
                await supabase
                  .from('truck_posts')
                  .update({ reminder_id: reminderData.id })
                  .eq('id', postId)

                // Audit the reminder creation
                await supabase
                  .from('audit_logs')
                  .insert({
                    action: 'create_reminder_from_truck_post',
                    entity: 'reminder',
                    entity_id: reminderData.id,
                    meta: {
                      truck_id: threadData.truck_id,
                      thread_id: threadId,
                      post_id: postId,
                      post_kind: postData.kind
                    }
                  })
              }
            }
          }
        } catch (reminderError) {
          console.error('Failed to create reminder:', reminderError)
          // Don't fail the whole operation if reminder creation fails
        }
      }

      // Update thread timestamp
      await supabase
        .from('truck_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId)

      return { postId }
    } catch (error) {
      console.error('Error creating post:', error)
      throw new Error('Failed to create post')
    }
  }
)

/**
 * Update post status
 */
export const updatePostStatus = makeTechnicianAction(
  z.object({
    postId: z.string().uuid(),
    status: z.enum(['open', 'acknowledged', 'resolved'])
  }),
  async ({ postId, status }, { user, role }): Promise<{ success: boolean }> => {
    const supabase = await getServerSupabase()

    try {
      // Get current post data
      const { data: currentPost, error: fetchError } = await supabase
        .from('truck_posts')
        .select('status, created_by, thread_id')
        .eq('id', postId)
        .single()

      if (fetchError || !currentPost) {
        throw new Error('Post not found')
      }

      const oldStatus = currentPost.status

      // Check permissions
      if (role === 'technician') {
        // Technicians can only acknowledge their own posts
        if (currentPost.created_by !== user.id) {
          throw new Error('Cannot update another user\'s post')
        }
        if (status === 'resolved') {
          throw new Error('Technicians cannot resolve posts')
        }
        if (oldStatus !== 'open') {
          throw new Error('Can only acknowledge open posts')
        }
      }

      // Update the post
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      }

      if (status === 'acknowledged' && oldStatus === 'open') {
        updateData.acknowledged_at = new Date().toISOString()
        updateData.acknowledged_by = user.id
      } else if (status === 'resolved') {
        updateData.resolved_at = new Date().toISOString()
        updateData.resolved_by = user.id
      }

      const { error: updateError } = await supabase
        .from('truck_posts')
        .update(updateData)
        .eq('id', postId)

      if (updateError) {
        throw new Error(`Failed to update post: ${updateError.message}`)
      }

      // Check if all posts in thread are resolved
      if (status === 'resolved') {
        const { data: openPosts } = await supabase
          .from('truck_posts')
          .select('id')
          .eq('thread_id', currentPost.thread_id)
          .neq('status', 'resolved')
          .limit(1)

        // If no open posts, mark thread as resolved
        if (!openPosts || openPosts.length === 0) {
          await supabase
            .from('truck_threads')
            .update({
              status: 'resolved',
              updated_at: new Date().toISOString(),
              resolved_at: new Date().toISOString(),
              resolved_by: user.id
            })
            .eq('id', currentPost.thread_id)
        }
      }

      // Audit the status change
      await supabase
        .from('audit_logs')
        .insert({
          action: 'update_truck_post_status',
          entity: 'truck_post',
          entity_id: postId,
          meta: {
            from: oldStatus,
            to: status
          }
        })

      return { success: true }
    } catch (error) {
      console.error('Error updating post status:', error)
      throw new Error('Failed to update post status')
    }
  }
)

/**
 * Update thread status (admin/dispatcher only)
 */
export const updateThreadStatus = makeDispatcherAction(
  z.object({
    threadId: z.string().uuid(),
    status: z.enum(['open', 'acknowledged', 'resolved'])
  }),
  async ({ threadId, status }, { user, role }): Promise<{ success: boolean }> => {
    const supabase = await getServerSupabase()

    try {
      // Get current thread status
      const { data: currentThread, error: fetchError } = await supabase
        .from('truck_threads')
        .select('status')
        .eq('id', threadId)
        .single()

      if (fetchError || !currentThread) {
        throw new Error('Thread not found')
      }

      const oldStatus = currentThread.status

      // Update the thread
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      }

      if (status === 'resolved') {
        updateData.resolved_at = new Date().toISOString()
        updateData.resolved_by = user.id
      }

      const { error: updateError } = await supabase
        .from('truck_threads')
        .update(updateData)
        .eq('id', threadId)

      if (updateError) {
        throw new Error(`Failed to update thread: ${updateError.message}`)
      }

      // Audit the status change
      await supabase
        .from('audit_logs')
        .insert({
          action: 'update_truck_thread_status',
          entity: 'truck_thread',
          entity_id: threadId,
          meta: {
            from: oldStatus,
            to: status
          }
        })

      return { success: true }
    } catch (error) {
      console.error('Error updating thread status:', error)
      throw new Error('Failed to update thread status')
    }
  }
)