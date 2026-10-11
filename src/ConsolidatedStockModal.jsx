import React from 'react';

export default function ConsolidatedStockModal({ orders = [], onClose }) {
  if (!orders || orders.length === 0) return null;

  // Aggregate item quantities across all filtered orders
  const aggregatedMap = {};
  let totalBagsOrUnits = 0;
  let totalWeightKg = 0;

  orders.forEach((ord) => {
    const rawItems = ord.OrderItems || ord.order_items || ord.items || [];
    rawItems.forEach((it) => {
      const prodName =
        it.ProductNameSnapshot ||
        it.ProductName ||
        it.product_name ||
        it.Products?.ProductName ||
        'Item';
      const uom = it.UomCodeSnapshot || it.UomCode || it.uom || 'Unit';
      const qty = parseFloat(it.Quantity || it.Qty || it.quantity || 0);
      const isKg = uom.toUpperCase() === 'KG';

      if (!aggregatedMap[prodName]) {
        aggregatedMap[prodName] = {
          prodName,
          uom,
          totalQty: 0,
          orderCount: 0,
        };
      }

      aggregatedMap[prodName].totalQty += qty;
      aggregatedMap[prodName].orderCount += 1;

      if (isKg) {
        totalWeightKg += qty;
      } else {
        totalBagsOrUnits += qty;
      }
    });
  });

  const consolidatedList = Object.values(aggregatedMap).sort((a, b) =>
    a.prodName.localeCompare(b.prodName)
  );

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) {
      alert('Please allow popups to print.');
      return;
    }

    const htmlContent = document.getElementById('printable-stock-sheet').innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Stock Picking Sheet</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm 10mm;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box !important;
            }
            body {
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
          </style>
        </head>
        <body class="p-4">
          ${htmlContent}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
                window.close();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-start overflow-y-auto p-3 sm:p-5">
      {/* Top Header Bar */}
      <div className="w-full max-w-2xl bg-slate-900 text-white p-3.5 sm:px-5 sm:py-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 shadow-xl shrink-0">
        <div>
          <h3 className="font-extrabold text-xs sm:text-sm text-slate-100 flex items-center gap-1.5">
            <span>📦 Consolidated Picking Sheet</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Total Orders: <span className="font-bold text-white">{orders.length}</span> • Unique Items:{' '}
            <span className="font-bold text-emerald-400">{consolidatedList.length}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 font-extrabold text-xs text-white rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>🖨️ Print Sheet</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 font-bold text-xs text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Sheet Container Card */}
      <div className="w-full max-w-2xl pb-10">
        <div
          id="printable-stock-sheet"
          className="w-full bg-white text-slate-900 p-4 sm:p-6 rounded-2xl shadow-xl border border-slate-200 box-border text-xs"
        >
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-3 mb-3.5 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight uppercase">
                Consolidated Picking Sheet
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {new Date().toLocaleDateString('en-GB')} • {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <span className="bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1 text-[11px] font-black font-mono text-slate-800 shrink-0">
              {orders.length} Orders
            </span>
          </div>

          {/* 1. Mobile Item List (Shows on screens < 640px) */}
          <div className="divide-y divide-slate-100 sm:hidden">
            {consolidatedList.map((item, idx) => (
              <div key={idx} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 pr-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-slate-400 font-bold">#{idx + 1}</span>
                    <h4 className="font-extrabold text-xs text-slate-900 uppercase truncate">
                      {item.prodName}
                    </h4>
                  </div>
                  <span className="inline-block mt-1 bg-slate-100 text-slate-600 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                    {item.orderCount} {item.orderCount > 1 ? 'shops' : 'shop'}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-black text-emerald-700 text-sm font-mono whitespace-nowrap">
                    {item.totalQty} {item.uom}
                  </span>
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded-sm border-slate-300 text-emerald-600 cursor-pointer"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* 2. Desktop Table (Shows on screens >= 640px) */}
          <div className="hidden sm:block overflow-hidden">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-100/90 border-y border-slate-300 font-extrabold text-slate-700 uppercase text-[10px]">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3 text-center">Orders Present</th>
                  <th className="py-2.5 px-3 text-right">Total Qty</th>
                  <th className="py-2.5 px-3 w-14 text-center">Loaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {consolidatedList.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 text-center font-mono text-slate-400 font-bold">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 font-extrabold text-slate-900 uppercase">
                      {item.prodName}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-500">
                      <span className="bg-slate-100 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                        {item.orderCount} {item.orderCount > 1 ? 'shops' : 'shop'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap font-black text-emerald-700 text-sm font-mono">
                      {item.totalQty} {item.uom}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded-sm border-slate-300 text-emerald-600 cursor-pointer"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Box */}
          <div className="mt-4 pt-3 border-t-2 border-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <span className="font-bold text-slate-800 text-xs block">Total Target To Pick:</span>
              <span className="text-[10px] text-slate-500">Check boxes once crates are loaded into the vehicle</span>
            </div>

            <div className="flex items-center gap-2 font-mono font-black text-sm">
              {totalWeightKg > 0 && (
                <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-emerald-800">
                  {totalWeightKg.toFixed(2)} KG
                </span>
              )}
              {totalBagsOrUnits > 0 && (
                <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800">
                  {totalBagsOrUnits} Units
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}