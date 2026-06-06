import { CheckCircle } from 'lucide-react'

export default function SignatureBlock({ verifiedIdentity, onSign, signed, signedAt }) {
  if (!verifiedIdentity) return null

  if (signed) return (
    <div className="mt-6 pt-4 border-t-2 border-emerald-200 bg-emerald-50 rounded-lg px-4 py-3">
      <div className="flex items-center gap-2">
        <CheckCircle size={18} className="text-emerald-600" />
        <span className="text-sm font-semibold text-emerald-800">Signed &amp; Locked</span>
      </div>
      <p className="text-xs text-emerald-700 mt-1">
        {verifiedIdentity.full_name}
        {verifiedIdentity.credentials
          ? ` · ${verifiedIdentity.credentials}`
          : ` · ${verifiedIdentity.role.replace(/_/g, ' ')}`}
        {' · '}{signedAt}
      </p>
      <p className="text-xs text-gray-400 mt-1 italic">
        This document is locked. Use "Add Addendum" for corrections.
      </p>
    </div>
  )

  return (
    <div className="mt-6 pt-4 border-t border-gray-200">
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        <input type="checkbox" id="sign-confirm" onChange={e => e.target.checked && onSign()}
          className="mt-0.5 w-4 h-4 accent-emerald-600 cursor-pointer" />
        <label htmlFor="sign-confirm" className="text-sm text-amber-900 cursor-pointer">
          I, <strong>{verifiedIdentity.full_name}</strong>
          {verifiedIdentity.credentials ? ` (${verifiedIdentity.credentials})` : ''},
          confirm this documentation is accurate and complete.
        </label>
      </div>
      <p className="text-xs text-gray-400 mt-2 text-right">Once signed, this document will be locked.</p>
    </div>
  )
}
