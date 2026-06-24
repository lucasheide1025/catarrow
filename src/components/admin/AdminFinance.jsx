// src/components/admin/AdminFinance.jsx — 財務中心（月卡 + 會計）
import { useState } from "react";
import AdminMonthlyCard from "./AdminMonthlyCard";
import BillingSystem    from "./BillingSystem";

export default function AdminFinance({ adminProfile }) {
  const [tab, setTab] = useState("monthlycard");

  return (
    <div>
      <div className="flex gap-2 p-4 pb-0">
        {[
          { id: "monthlycard", label: "🎫 月卡管理" },
          { id: "billing",     label: "💰 會計記帳" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-black border transition-all ${tab === t.id ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "monthlycard" && <AdminMonthlyCard adminProfile={adminProfile} />}
      {tab === "billing"     && <BillingSystem    profile={adminProfile} />}
    </div>
  );
}
