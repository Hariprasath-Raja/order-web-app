import React, { useRef } from 'react';

export default function InvoicePrintModal({ orders = [], agencyDetails = {}, onClose }) {
  const printAreaRef = useRef(null);

  if (!orders || orders.length === 0) return null;

  const handleBrowserPrint = () => {
    window.print();
  };

  const toNum = (val, fallback = 0) => {
    const n = parseFloat(val);
    return isNaN(n) ? fallback : n;
  };

  const calculateTaxBreakdown = (items) => {
    const slabs = {
      0: { taxable: 0, cgst: 0, sgst: 0 },
      5: { taxable: 0, cgst: 0, sgst: 0 },
      18: { taxable: 0, cgst: 0, sgst: 0 },
      28: { taxable: 0, cgst: 0, sgst: 0 },
    };

    items.forEach((item) => {
      const gstRate = Math.round(
        toNum(item.TaxPercentageSnapshot || item.TaxPercentage || item.gst_rate, 5)
      );
      const qty = toNum(item.Quantity || item.Qty || item.quantity, 1);
      const rate = toNum(item.UnitPriceSnapshot || item.UnitPrice || item.Rate || item.rate, 0);
      const taxableAmount = qty * rate;
      const cgst = toNum(item.CgstAmount, (taxableAmount * (gstRate / 100)) / 2);
      const sgst = toNum(item.SgstAmount, (taxableAmount * (gstRate / 100)) / 2);

      if (slabs[gstRate]) {
        slabs[gstRate].taxable += taxableAmount;
        slabs[gstRate].cgst += cgst;
        slabs[gstRate].sgst += sgst;
      } else {
        slabs[5].taxable += taxableAmount;
        slabs[5].cgst += cgst;
        slabs[5].sgst += sgst;
      }
    });

    return slabs;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-start overflow-y-auto p-4 sm:p-6 print:p-0 print:bg-white print:static print:block">
      {/* Strict Print CSS for Exact Single Page A4 Landscape Full Height */}
      <style>{`
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: 100% !important;
            background: #fff !important;
            color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-invoice-root, #printable-invoice-root * {
            visibility: visible !important;
          }
          #printable-invoice-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print-bar {
            display: none !important;
          }
          @page {
            size: A4 landscape;
            margin: 4mm 5mm 4mm 5mm;
          }
          .a4-landscape-page {
            page-break-after: always !important;
            break-after: page !important;
            height: 194mm !important;
            max-height: 194mm !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* Top Action Bar (Hidden in Print) */}
      <div className="no-print-bar w-full max-w-7xl bg-slate-900 text-white px-5 py-3 rounded-2xl flex items-center justify-between mb-4 shadow-xl">
        <div>
          <h3 className="font-extrabold text-sm sm:text-base">
            🖨️ Print Invoices ({orders.length})
          </h3>
          <p className="text-[11px] text-slate-400">
            A4 Landscape Full Height Lock (Exact 1 Page Per Order)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBrowserPrint}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 font-extrabold text-xs text-white rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
          >
            🖨️ Print Now ({orders.length})
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 font-bold text-xs text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div
        ref={printAreaRef}
        id="printable-invoice-root"
        className="w-full max-w-7xl bg-white text-black p-4 sm:p-6 rounded-2xl shadow-2xl print:shadow-none print:p-0"
      >
        {orders.map((order, orderIdx) => {
          const rawItems = order.OrderItems || order.order_items || order.items || [];
          const items = rawItems.map((item) => {
            const qty = toNum(item.Quantity ?? item.Qty ?? item.quantity, 1);
            const rate = toNum(item.UnitPriceSnapshot ?? item.UnitPrice ?? item.Rate ?? item.rate, 0);
            const gst = toNum(item.TaxPercentageSnapshot ?? item.TaxPercentage ?? item.gst_rate, 5);
            const lineTotal = toNum(item.LineTotal, qty * rate * (1 + gst / 100));

            return {
              prodName:
                item.ProductNameSnapshot ||
                item.ProductName ||
                item.product_name ||
                item.Products?.ProductName ||
                'Product Item',
              hsn: item.HsnCode || item.HsnCodeSnapshot || item.hsn_code || '1905',
              qty,
              rate,
              mrp: toNum(item.Mrp ?? item.mrp, rate),
              gst,
              lineTotal,
            };
          });

          const totalQty = items.reduce((sum, i) => sum + i.qty, 0);
          const taxableSubtotal = toNum(
            order.SubTotal,
            items.reduce((sum, i) => sum + i.qty * i.rate, 0)
          );
          const totalTax = toNum(
            order.TotalTaxAmount,
            items.reduce((sum, i) => sum + (i.qty * i.rate * (i.gst / 100)), 0)
          );
          const grandTotal = toNum(order.TotalAmount, taxableSubtotal + totalTax);
          const taxBreakdown = calculateTaxBreakdown(items);

          const targetRows = 20;
          const emptyRowsCount = Math.max(0, targetRows - items.length);

          const customerPhone =
            order.PhoneSnapshot ||
            order.ShopDetails?.Phone ||
            order.ShopDetails?.Users?.Phone ||
            '';

          const customerGstin =
            order.GstinSnapshot ||
            order.ShopDetails?.GstNumber ||
            '';

          return (
            <div
              key={order.OrderId || orderIdx}
              className={`a4-landscape-page w-full flex gap-2.5 text-[9.5px] leading-tight font-sans ${
                orderIdx < orders.length - 1 ? 'mb-8' : ''
              }`}
              style={{ minHeight: '190mm', height: '194mm' }}
            >
              {/* ========================================================= */}
              {/* LEFT SIDE: MAIN TAX INVOICE (68%) */}
              {/* ========================================================= */}
              <div className="w-[68%] border-2 border-black flex flex-col justify-between p-2 h-full box-border">
                <div className="flex-1 flex flex-col">
                  {/* Header */}
                  <div className="grid grid-cols-12 border-b-2 border-black pb-1.5 mb-1 gap-2">
                    <div className="col-span-6 pr-2">
                      <h2 className="font-extrabold text-[13px] uppercase tracking-wide">
                        {agencyDetails.AgencyName || 'SHREE GOWSHIK AGENCIES'}
                      </h2>
                      <p className="text-[8.5px] text-gray-800 mt-0.5 whitespace-pre-line leading-tight">
                        {agencyDetails.Address || '12/3 ,Agrargaram street ,Tharamangalam ,salem'}
                      </p>
                      <p className="text-[8.5px] font-semibold mt-0.5">
                        Phone: {agencyDetails.Phone || '9600791919'}
                      </p>
                      <p className="text-[8.5px] font-extrabold mt-0.5 font-mono">
                        GSTIN: {agencyDetails.Gstin || '33FKIPS0747H1ZY'}
                      </p>
                    </div>

                    <div className="col-span-6 border-l-2 border-black pl-2 flex flex-col justify-between">
                      <div>
                        <span className="text-[8.5px] font-bold text-gray-500 uppercase tracking-wider block">
                          CUSTOMER:
                        </span>
                        <h3 className="font-extrabold text-[11px] uppercase mt-0.5 truncate">
                          {order.ShopNameSnapshot || order.ShopDetails?.ShopName || 'SRI MURUGAN STORES'}
                        </h3>
                        <p className="text-[8.5px] text-gray-800 truncate">
                          {order.AddressSnapshot || order.ShopDetails?.Address || 'No 12, Bazaar St, North Gate, Salem'}
                        </p>
                        
                        {/* Customer Phone */}
                        <p className="text-[8.5px] text-gray-800 font-mono mt-0.5">
                          <span className="font-bold">Ph:</span> {customerPhone || '-'}
                        </p>

                        {/* Customer GSTIN */}
                        {customerGstin && (
                          <p className="text-[8.5px] font-extrabold font-mono text-gray-900 mt-0.5">
                            GSTIN: {customerGstin}
                          </p>
                        )}
                      </div>

                      <div className="text-right border-t border-gray-300 pt-0.5 mt-0.5">
                        <span className="font-extrabold text-[11px]">
                          Inv No: #{order.OrderId || '8'}
                        </span>
                        <span className="block text-[8.5px] text-gray-600">
                          Date: {new Date(order.CreatedAt || Date.now()).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="flex-1 flex flex-col">
                    <table className="w-full border-collapse border border-black text-left text-[8.5px]">
                      <thead>
                        <tr className="border-b-2 border-black bg-gray-100 font-extrabold text-center h-[20px]">
                          <th className="border-r border-black py-0.5 px-1 w-6">S.</th>
                          <th className="border-r border-black py-0.5 px-1 w-11">HSN</th>
                          <th className="border-r border-black py-0.5 px-2 text-left">Product Name</th>
                          <th className="border-r border-black py-0.5 px-1 w-8">Qty</th>
                          <th className="border-r border-black py-0.5 px-1 w-11">Rate</th>
                          <th className="border-r border-black py-0.5 px-1 w-11">MRP</th>
                          <th className="border-r border-black py-0.5 px-1 w-7">Dis%</th>
                          <th className="border-r border-black py-0.5 px-1 w-9">GST%</th>
                          <th className="py-0.5 px-1 w-14 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it, idx) => (
                          <tr key={idx} className="border-b border-gray-300 text-center font-medium h-[18px]">
                            <td className="border-r border-black py-0.5 px-1">{idx + 1}</td>
                            <td className="border-r border-black py-0.5 px-1 font-mono">{it.hsn}</td>
                            <td className="border-r border-black py-0.5 px-2 text-left font-bold truncate max-w-[170px]">
                              {it.prodName}
                            </td>
                            <td className="border-r border-black py-0.5 px-1 font-bold">{it.qty}</td>
                            <td className="border-r border-black py-0.5 px-1 font-mono">₹{it.rate.toFixed(2)}</td>
                            <td className="border-r border-black py-0.5 px-1 font-mono">₹{it.mrp.toFixed(2)}</td>
                            <td className="border-r border-black py-0.5 px-1">0%</td>
                            <td className="border-r border-black py-0.5 px-1 font-bold">{it.gst}%</td>
                            <td className="py-0.5 px-1 text-right font-bold font-mono">₹{it.lineTotal.toFixed(2)}</td>
                          </tr>
                        ))}

                        {/* Blank Rows for Uniform Height */}
                        {Array.from({ length: emptyRowsCount }).map((_, idx) => (
                          <tr key={`fill-${idx}`} className="border-b border-gray-200 text-center h-[18px]">
                            <td className="border-r border-black">&nbsp;</td>
                            <td className="border-r border-black">&nbsp;</td>
                            <td className="border-r border-black">&nbsp;</td>
                            <td className="border-r border-black">&nbsp;</td>
                            <td className="border-r border-black">&nbsp;</td>
                            <td className="border-r border-black">&nbsp;</td>
                            <td className="border-r border-black">&nbsp;</td>
                            <td className="border-r border-black">&nbsp;</td>
                            <td>&nbsp;</td>
                          </tr>
                        ))}

                        {/* In-Table Total Row */}
                        <tr className="border-t-2 border-black font-extrabold bg-gray-50 h-[22px]">
                          <td colSpan={3} className="border-r border-black py-1 px-2 text-right">TOTAL:</td>
                          <td className="border-r border-black py-1 px-1 text-center font-bold">{totalQty}</td>
                          <td colSpan={4} className="border-r border-black">&nbsp;</td>
                          <td className="py-1 px-1 text-right font-mono font-extrabold">₹{grandTotal.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer Tax Grid */}
                <div className="mt-1 pt-1.5 border-t-2 border-black">
                  <div className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-8">
                      <table className="w-full border-collapse border border-black text-center text-[7.5px]">
                        <thead>
                          <tr className="border-b border-black bg-gray-100 font-bold">
                            <th className="border-r border-black py-0.5">Rate</th>
                            <th className="border-r border-black py-0.5">0%</th>
                            <th className="border-r border-black py-0.5">5%</th>
                            <th className="border-r border-black py-0.5">18%</th>
                            <th className="border-r border-black py-0.5">28%</th>
                            <th className="py-0.5 font-extrabold">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-gray-300">
                            <td className="border-r border-black font-bold text-left px-1">Taxable</td>
                            <td className="border-r border-black font-mono">{taxBreakdown[0].taxable.toFixed(2)}</td>
                            <td className="border-r border-black font-mono">{taxBreakdown[5].taxable.toFixed(2)}</td>
                            <td className="border-r border-black font-mono">{taxBreakdown[18].taxable.toFixed(2)}</td>
                            <td className="border-r border-black font-mono">{taxBreakdown[28].taxable.toFixed(2)}</td>
                            <td className="font-mono font-bold">{taxableSubtotal.toFixed(2)}</td>
                          </tr>
                          <tr className="border-b border-gray-300">
                            <td className="border-r border-black font-bold text-left px-1">CGST</td>
                            <td className="border-r border-black font-mono">{taxBreakdown[0].cgst.toFixed(2)}</td>
                            <td className="border-r border-black font-mono">{taxBreakdown[5].cgst.toFixed(2)}</td>
                            <td className="border-r border-black font-mono">{taxBreakdown[18].cgst.toFixed(2)}</td>
                            <td className="border-r border-black font-mono">{taxBreakdown[28].cgst.toFixed(2)}</td>
                            <td className="font-mono font-bold">{(totalTax / 2).toFixed(2)}</td>
                          </tr>
                          <tr>
                            <td className="border-r border-black font-bold text-left px-1">SGST</td>
                            <td className="border-r border-black font-mono">{taxBreakdown[0].sgst.toFixed(2)}</td>
                            <td className="border-r border-black font-mono">{taxBreakdown[5].sgst.toFixed(2)}</td>
                            <td className="border-r border-black font-mono">{taxBreakdown[18].sgst.toFixed(2)}</td>
                            <td className="border-r border-black font-mono">{taxBreakdown[28].sgst.toFixed(2)}</td>
                            <td className="font-mono font-bold">{(totalTax / 2).toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <p className="text-[7px] text-gray-500 italic mt-0.5">Subject to Salem Jurisdiction only.</p>
                    </div>

                    <div className="col-span-4 flex flex-col justify-between h-full text-[8.5px]">
                      <div className="space-y-0.5">
                        <div className="flex justify-between">
                          <span>Total Qty:</span>
                          <span className="font-bold">{totalQty}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Discount:</span>
                          <span className="font-mono">0.00</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Round Off:</span>
                          <span className="font-mono">0.00</span>
                        </div>
                        <div className="flex justify-between border-t border-black pt-0.5 font-extrabold text-[10px]">
                          <span>Inv Total:</span>
                          <span className="font-mono">₹{grandTotal.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="text-center mt-2 pt-1 border-t border-dashed border-gray-400">
                        <span className="text-[7.5px] font-bold">For Authorised Signatory</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ========================================================= */}
              {/* RIGHT SIDE: DELIVERY CHALLAN (32%) */}
              {/* ========================================================= */}
              <div className="w-[32%] border-2 border-black flex flex-col justify-between p-2 h-full box-border">
                <div className="flex-1 flex flex-col">
                  <div className="border-b-2 border-black pb-1 mb-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-extrabold text-[10px] uppercase truncate">
                          {agencyDetails.AgencyName || 'SHREE GOWSHIK AGENCIES'}
                        </h3>
                        <p className="font-bold text-[9.5px] text-gray-800 truncate">
                          {order.ShopNameSnapshot || order.ShopDetails?.ShopName || 'SRI MURUGAN STORES'}
                        </p>
                        <p className="text-[8px] font-mono text-gray-700">
                          Ph: {customerPhone || '-'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-[8.5px]">No: #{order.OrderId || '8'}</span>
                        <span className="block text-[7.5px] text-gray-600">
                          Date: {new Date(order.CreatedAt || Date.now()).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col">
                    <table className="w-full border-collapse border border-black text-left text-[8.5px]">
                      <thead>
                        <tr className="border-b-2 border-black bg-gray-100 font-extrabold text-center h-[20px]">
                          <th className="border-r border-black py-0.5 px-1 w-6">No</th>
                          <th className="border-r border-black py-0.5 px-2 text-left">Product Name</th>
                          <th className="py-0.5 px-1 w-10 text-center">Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it, idx) => (
                          <tr key={idx} className="border-b border-gray-300 h-[18px]">
                            <td className="border-r border-black py-0.5 px-1 text-center font-semibold">{idx + 1}</td>
                            <td className="border-r border-black py-0.5 px-2 font-bold truncate max-w-[120px]">
                              {it.prodName}
                            </td>
                            <td className="py-0.5 px-1 text-center font-bold font-mono">{it.qty}</td>
                          </tr>
                        ))}

                        {Array.from({ length: emptyRowsCount }).map((_, idx) => (
                          <tr key={`dc-fill-${idx}`} className="border-b border-gray-200 text-center h-[18px]">
                            <td className="border-r border-black">&nbsp;</td>
                            <td className="border-r border-black">&nbsp;</td>
                            <td>&nbsp;</td>
                          </tr>
                        ))}

                        <tr className="border-t-2 border-black font-extrabold bg-gray-50 h-[22px]">
                          <td colSpan={2} className="border-r border-black py-1 px-2 text-right">TOTAL:</td>
                          <td className="py-1 px-1 text-center font-bold">{totalQty}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-1 pt-1.5 border-t-2 border-black">
                  <div className="space-y-0.5 text-[8px]">
                    <div className="flex justify-between">
                      <span>Total Qty:</span>
                      <span className="font-bold">{totalQty}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Discount: 0.00</span>
                      <span>Round Off: 0.00</span>
                    </div>
                    <div className="flex justify-between font-extrabold text-[9.5px] border-t border-black pt-0.5">
                      <span>Inv Total:</span>
                      <span className="font-mono">₹{grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="text-center mt-3 pt-1 border-t border-dashed border-gray-400">
                    <span className="text-[7.5px] font-bold">Customer Seal & Sign</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}