import Link from 'next/link'
import { User, Database, LayoutGrid, CloudUpload, ChevronRight, FolderTree, Hash, Settings } from 'lucide-react'

export default function AdminLandingPage() {
  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="mb-10">
        <h2 className="text-4xl font-black text-gray-900 mb-4">Documentation Dashboard</h2>
        <p className="text-lg text-gray-600">Welcome to the Prepnova Education Admin CMS. Select a tool from the sidebar or review the system capabilities below.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        <div className="bg-white border border-gray-200 p-8 rounded-2xl shadow-sm hover:shadow-md transition group">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-xl"><User className="w-8 h-8" /></div>
            <h3 className="text-2xl font-bold text-gray-800">User Management</h3>
          </div>
          <p className="text-gray-600 leading-relaxed mb-6">
            Manage student access and subscriptions. Upgrade students to Premium with strict <strong>Fixed Date Expiration</strong> logic, enabling the automated Auto-Downgrade Engine. Enforce security via manual <strong>Force Password Resets</strong>, bypassing client-side vulnerabilities.
          </p>
          <Link href="/admin/users" className="inline-flex items-center gap-2 text-blue-600 font-bold hover:text-blue-800 transition">
            Launch Tool <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="bg-white border border-gray-200 p-8 rounded-2xl shadow-sm hover:shadow-md transition group">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-xl"><Database className="w-8 h-8" /></div>
            <h3 className="text-2xl font-bold text-gray-800">Question Bank</h3>
          </div>
          <p className="text-gray-600 leading-relaxed mb-6">
            The central repository for over 10,000+ SAT questions. Utilize advanced filtering (by Subject, Topic, Difficulty, Image Status). Any manual question edits trigger <strong>Pre-Save Validation</strong>, regenerating the cryptographic SHA-256 hash to prevent "backdoor" duplicates.
          </p>
          <Link href="/admin/question-bank" className="inline-flex items-center gap-2 text-indigo-600 font-bold hover:text-indigo-800 transition">
            Launch Tool <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="bg-white border border-gray-200 p-8 rounded-2xl shadow-sm hover:shadow-md transition group">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-purple-50 text-purple-600 rounded-xl"><LayoutGrid className="w-8 h-8" /></div>
            <h3 className="text-2xl font-bold text-gray-800">Module Builder</h3>
          </div>
          <p className="text-gray-600 leading-relaxed mb-6">
            Construct SAT exams utilizing our <strong>Bidirectional Array Syncing</strong> architecture. Drag and drop questions to define exact test sequences directly in the `TEXT[]` array without bloating the database with heavy junction tables.
          </p>
          <Link href="/admin/module-builder" className="inline-flex items-center gap-2 text-purple-600 font-bold hover:text-purple-800 transition">
            Launch Tool <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="bg-white border border-gray-200 p-8 rounded-2xl shadow-sm hover:shadow-md transition group">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-pink-50 text-pink-600 rounded-xl"><CloudUpload className="w-8 h-8" /></div>
            <h3 className="text-2xl font-bold text-gray-800">Bulk Uploader</h3>
          </div>
          <p className="text-gray-600 leading-relaxed mb-6">
            Securely import JSON payloads. Features a strict Zero-Trust <strong>Redundancy Pipeline</strong> (comparing two independent imports), automated QID fixing, missing image detection, and an iterative <strong>Conflict Resolver UI</strong> featuring the "Restructure Hash" escape hatch.
          </p>
          <Link href="/admin/bulk-uploader" className="inline-flex items-center gap-2 text-pink-600 font-bold hover:text-pink-800 transition">
            Launch Tool <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        
        <div className="bg-white border border-gray-200 p-8 rounded-2xl shadow-sm hover:shadow-md transition group">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-teal-50 text-teal-600 rounded-xl"><FolderTree className="w-8 h-8" /></div>
            <h3 className="text-2xl font-bold text-gray-800">Directory Manager</h3>
          </div>
          <p className="text-gray-600 leading-relaxed mb-6">
            Organize the platform utilizing a visual <strong>Virtual File System</strong> interface. Rename files, create directories, and drag-and-drop Practice Tests and Modules across folders to seamlessly arrange the student dashboard structure.
          </p>
          <Link href="/admin/directory-manager" className="inline-flex items-center gap-2 text-teal-600 font-bold hover:text-teal-800 transition">
            Launch Tool <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="bg-white border border-gray-200 p-8 rounded-2xl shadow-sm hover:shadow-md transition group">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-orange-50 text-orange-600 rounded-xl"><Hash className="w-8 h-8" /></div>
            <h3 className="text-2xl font-bold text-gray-800">Hash Rehasher</h3>
          </div>
          <p className="text-gray-600 leading-relaxed mb-6">
            Cryptographic utility to forcefully regenerate SHA-256 hashes for all questions in the database. Resolves hash mismatch errors caused by manual edits and prevents collisions during bulk JSON imports.
          </p>
          <Link href="/admin/hash-rehash" className="inline-flex items-center gap-2 text-orange-600 font-bold hover:text-orange-800 transition">
            Launch Tool <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="bg-white border border-gray-200 p-8 rounded-2xl shadow-sm hover:shadow-md transition group">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl"><Settings className="w-8 h-8" /></div>
            <h3 className="text-2xl font-bold text-gray-800">Practice Engine Config</h3>
          </div>
          <p className="text-gray-600 leading-relaxed mb-6">
            Configure the allowed question sources for the Practice Engine. This acts as a master switch to strictly enforce which content banks students are allowed to pull from during randomized sessions.
          </p>
          <Link href="/admin/practice-config" className="inline-flex items-center gap-2 text-emerald-600 font-bold hover:text-emerald-800 transition">
            Launch Tool <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

      </div>
    </div>
  )
}
