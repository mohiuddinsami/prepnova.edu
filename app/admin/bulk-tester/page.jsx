import BulkTesterClient from './BulkTesterClient'

export const metadata = {
  title: 'Bulk Tester (Local RAM) | PrepNova Admin',
}

export default function BulkTesterPage() {
  return (
    <div className="flex flex-col h-full w-full">
      <BulkTesterClient />
    </div>
  )
}
