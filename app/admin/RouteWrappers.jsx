'use client'

import { useState } from 'react'
import { createContentClient as createClient } from '@/utils/supabase/client'
import { UserManagement, QuestionBank, ModuleBuilder, BulkUploader, TestBuilder, DirectoryManager } from './AdminClient'
import { fetchAdminQuestionsAction, fetchAdminModulesAction, fetchAdminTestsAction } from '@/app/actions/moduleAssignmentActions'

export function UsersRoute({ initialUsers }) {
  return <UserManagement initialUsers={initialUsers} />
}

export function QuestionBankRoute({ initialQuestions, initialModules }) {
  const [questions, setQuestions] = useState(initialQuestions)
  const [modules, setModules] = useState(initialModules)
  const supabase = createClient()

  const fetchData = async () => {
    const qRes = await fetchAdminQuestionsAction()
    const mRes = await fetchAdminModulesAction()
    if (qRes.success && qRes.data.length > 0) setQuestions(qRes.data)
    if (mRes.success) setModules(mRes.data)
  }

  return <QuestionBank questions={questions} modules={modules} onUpdate={fetchData} supabase={supabase} />
}

export function ModuleBuilderRoute({ initialQuestions, initialModules }) {
  const [questions, setQuestions] = useState(initialQuestions)
  const [modules, setModules] = useState(initialModules)
  const supabase = createClient()

  const fetchData = async () => {
    const qRes = await fetchAdminQuestionsAction()
    const mRes = await fetchAdminModulesAction()
    if (qRes.success && qRes.data.length > 0) setQuestions(qRes.data)
    if (mRes.success) setModules(mRes.data)
  }

  return <ModuleBuilder modules={modules} setModules={setModules} questions={questions} setQuestions={setQuestions} onUpdate={fetchData} supabase={supabase} />
}

export function BulkUploaderRoute() {
  const supabase = createClient()
  return <BulkUploader onUploadComplete={() => {}} supabase={supabase} />
}

export function TestBuilderRoute({ initialQuestions, initialModules, initialTests }) {
  const [questions, setQuestions] = useState(initialQuestions)
  const [modules, setModules] = useState(initialModules)
  const [tests, setTests] = useState(initialTests)
  const supabase = createClient()

  const fetchData = async () => {
    console.log('[TestBuilderRoute.fetchData] Starting refetch via server actions...');
    const qRes = await fetchAdminQuestionsAction()
    const mRes = await fetchAdminModulesAction()
    const tRes = await fetchAdminTestsAction()
    console.log('[TestBuilderRoute.fetchData] Questions:', qRes.success, 'count:', qRes.data?.length, '| Modules:', mRes.success, 'count:', mRes.data?.length, '| Tests:', tRes.success, 'count:', tRes.data?.length);
    if (qRes.success && qRes.data.length > 0) setQuestions(qRes.data)
    if (mRes.success) setModules(mRes.data)
    if (tRes.success) setTests(tRes.data)
    console.log('[TestBuilderRoute.fetchData] State updated.');
  }

  return <TestBuilder modules={modules} setModules={setModules} questions={questions} setQuestions={setQuestions} tests={tests} setTests={setTests} onUpdate={fetchData} supabase={supabase} />
}

export function DirectoryManagerRoute({ initialQuestions, initialModules, initialTests, initialFiles }) {
  const [questions, setQuestions] = useState(initialQuestions)
  const [modules, setModules] = useState(initialModules)
  const [tests, setTests] = useState(initialTests)
  const [files, setFiles] = useState(initialFiles)
  const supabase = createClient()

  const fetchData = async () => {
    const qRes = await fetchAdminQuestionsAction()
    const mRes = await fetchAdminModulesAction()
    const tRes = await fetchAdminTestsAction()
    const { data: fData } = await supabase.from('files').select('*')
    if (qRes.success && qRes.data.length > 0) setQuestions(qRes.data)
    if (mRes.success) setModules(mRes.data)
    if (tRes.success) setTests(tRes.data)
    if (fData) setFiles(fData)
  }

  return <DirectoryManager modules={modules} tests={tests} files={files} questions={questions} setQuestions={setQuestions} setModules={setModules} onUpdate={fetchData} supabase={supabase} />
}
