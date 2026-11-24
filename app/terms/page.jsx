import React from 'react';
import Link from 'next/link';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#050805] text-white p-8 sm:p-16 flex justify-center">
      <div className="w-full max-w-4xl bg-[#0a0f0a]/60 backdrop-blur-xl border border-white/10 p-8 sm:p-12 rounded-3xl shadow-2xl">
        <Link href="/" className="inline-block mb-8 text-[#D0F288] hover:underline text-sm font-medium">
          &larr; Back to Home
        </Link>
        <h1 className="text-4xl font-bold mb-8 text-[#D0F288] tracking-tight">Terms of Service & Privacy Policy</h1>
        
        <div className="space-y-6 text-white/80 font-light leading-relaxed">
          <p>
            Welcome to Prepnova Education (accessible at prepnovaed.com). Please read these Terms of Service and Privacy Policy carefully before using our platform.
          </p>
          
          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">1. Acceptance of Terms</h2>
          <p>
            By accessing or using our service, you agree to be bound by these Terms of Service and our Privacy Policy. If you disagree with any part of these terms, you may not access or use our service. These terms apply to all visitors, registered users, and others who access the platform.
          </p>
          
          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">2. Intellectual Property & Anti-Scraping</h2>
          <p>
            All content provided on Prepnova Education, including but not limited to test questions, study modules, software code, algorithms, platform design, and text, are the exclusive intellectual property of Prepnova Education. You are strictly prohibited from copying, modifying, distributing, selling, or leasing any part of our services or included software. Furthermore, web scraping, data mining, automated data extraction, or the use of our proprietary content to train external artificial intelligence (AI) models or large language models (LLMs) is strictly prohibited and constitutes a direct violation of these terms.
          </p>
          
          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">3. User Accounts & Conduct</h2>
          <p>
            To use certain features of our service, you must register for an account. You agree to provide accurate and complete information and keep this information up to date. You are solely responsible for maintaining the confidentiality of your account and password, and you agree to accept responsibility for all activities that occur under your account. Sharing accounts between multiple individuals is strictly prohibited and may result in immediate suspension or termination of your account without refund.
          </p>

          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">4. Privacy Policy & Data Collection</h2>
          <p>
            We value your privacy. Prepnova Education collects basic account information (such as your name and email address) and test performance data strictly to provide, maintain, and improve your personalized educational experience. We do not sell your personal data to third parties. By using our service, you consent to the collection and use of your information as outlined in this section.
          </p>

          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">5. Educational Disclaimer & Limitation of Liability</h2>
          <p>
            Prepnova Education provides preparation tools and materials &quot;as is&quot; and &quot;as available&quot; without any warranties of any kind. While we strive to provide high-quality educational resources, we do not guarantee specific test scores, academic outcomes, or university admissions as a result of using our platform. In no event shall Prepnova Education be liable for any indirect, incidental, special, consequential, or punitive damages arising out of your use of the service.
          </p>
          
          <p className="pt-12 text-sm text-white/40 border-t border-white/10 mt-8">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
