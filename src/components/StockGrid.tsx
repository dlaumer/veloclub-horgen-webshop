// src/components/StockGrid.tsx
import { useEffect, useState } from 'react';
import { fetchStock, type Product } from '@/lib/stockApi';

export default function StockGrid() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    console.log("StockGrid mounted");
    let on = true;
    fetchStock()
      .then(d => { if (on) setItems(d); })
      .catch(e => { if (on) setErr(String(e)); })
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, []);

  if (loading) return <div>Loading stock…</div>;
  if (err) return <div className="text-red-600">Error: {err}</div>;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map(p => (
        <div key={p.sku} className="rounded-2xl p-4 shadow">
          {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="mb-3 h-40 w-full object-contain" />}
          <div className="font-semibold">{p.name}</div>
          <div className="text-sm text-gray-500">SKU: {p.sku}</div>
          <div className="mt-2">CHF {p.price.toFixed(2)}</div>
          <div className="mt-2 text-sm">
            {Object.entries(p.sizes).map(([size, qty]) => (
              <span key={size} className="mr-2">
                {size}:{' '}
                <span className={qty > 0 ? 'text-green-600' : 'text-red-600'}>{qty}</span>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
