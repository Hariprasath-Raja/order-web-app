import React from 'react';

export default function ConsolidatedStockModal({ orders, onClose }) {
  if (!orders || orders.length === 0) return null;

  // Aggregate item quantities across orders
  const aggregatedMap = {};

  orders.forEach((ord) => {
    (ord.OrderItems || []).forEach((item) => {
      const name = item.ProductNameSnapshot || 'Unknown Item';
      const uom = item.UomCodeSnapshot || 'PCS';
      const key = `${name}_${uom}`;

      if (!aggregatedMap[key]) {
        aggregatedMap[key] = {
          name,
          uom,
          totalQty: 0,
          totalWeight: 0,
          ordersCount: 0,
        };
      }
      aggregatedMap[key].totalQty += parseFloat(item.Quantity || 0);
      aggregatedMap[key].ordersCount += 1;
    });
  });

  const stockSummaryList = Object.values(aggregatedMap).sort((a, b) => b.totalQty - a.totalQty);

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:w-full print:max-w-none">
        <div className="bg-slate-900 text-white p-3 sm:p-4 flex items-center justify-between print:hidden">
          <div>
            <h3 className="font-bold text-sm">Godown Dispatch / Consolidated Stock Sheet</h3>
            <p className="text-xs text-slate-400">Total Orders Included: {orders.length}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer"
            >
              Print Picking Sheet
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-lg cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-6 bg-white text-slate-900 text-xs print:p-2 printable-area">
          <div className="border-b-2 border-slate-900 pb-3 mb-3 flex justify-between items-end">
            <div>
              <h2 className="text-base font-extrabold uppercase">CONSOLIDATED DISPATCH PICKING SHEET</h2>
              <p className="text-[11px] text-slate-600">Generated on: {new Date().toLocaleString('en-GB')}</p>
            </div>
            <div className="text-right font-bold text-xs">
              Orders Count: {orders.length}
            </div>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-900 bg-slate-100 font-bold">
                <th className="py-2 px-2 w-8">#</th>
                <th className="py-2 px-2">Product Name</th>
                <th className="py-2 px-2 text-center">Orders Present</th>
                <th className="py-2 px-2 text-right">Total Qty Required</th>
                <th className="py-2 px-2 text-center w-20">Loaded ✓</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {stockSummaryList.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-6 text-center text-slate-400">No items found in selected orders.</td>
                </tr>
              ) : (
                stockSummaryList.map((st, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-2 px-2 font-mono">{i + 1}</td>
                    <td className="py-2 px-2 font-bold uppercase">{st.name}</td>
                    <td className="py-2 px-2 text-center text-slate-500">{st.ordersCount} shops</td>
                    <td className="py-2 px-2 text-right font-extrabold text-sm text-emerald-800">
                      {st.totalQty} {st.uom}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <div className="w-5 h-5 border border-slate-400 rounded-sm mx-auto"></div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="mt-6 pt-3 border-t border-slate-400 flex justify-between items-center text-[11px] text-slate-500">
            <span>Verified By: ___________________</span>
            <span>Godown In-Charge Sign: ___________________</span>
          </div>
        </div>
      </div>
    </div>
  );
}