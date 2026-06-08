'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetcher } from '@/lib/api';
import { formatCurrency } from '@/lib/currency';
import { Button } from '@/components/ui/Button';
import { UtensilsCrossed, Clock, CheckCircle, XCircle, ChefHat } from 'lucide-react';

type FoodOrderRow = {
  _id: string;
  restaurantName: string;
  status: string;
  total: number;
  subtotal: number;
  items: { name: string; quantity: number; price: number }[];
  delivery: { address: string };
  customer?: { name?: string; phone?: string };
  createdAt: string;
  notes?: string;
};

export default function FoodOrdersPage() {
  const [orders, setOrders] = useState<FoodOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'active' | 'all'>('pending');
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query =
        filter === 'pending'
          ? '?status=PLACED'
          : filter === 'active'
            ? ''
            : '';
      const data = await fetcher(`/food/admin/orders${query}`);
      let list: FoodOrderRow[] = data.orders ?? [];
      if (filter === 'active') {
        list = list.filter(
          (o) => !['DELIVERED', 'CANCELLED', 'PLACED'].includes(o.status)
        );
      }
      if (filter === 'pending') {
        list = list.filter((o) => o.status === 'PLACED');
      }
      setOrders(list);
    } catch (e) {
      console.error(e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (orderId: string, action: 'accept' | 'reject' | 'ready') => {
    setActing(orderId);
    try {
      await fetcher(`/food/admin/orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex items-start gap-3">
        <UtensilsCrossed className="h-7 w-7 sm:h-8 sm:w-8 text-orange-500 shrink-0 mt-0.5" />
        <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Food orders</h1>
      <p className="text-sm sm:text-base text-gray-600 mt-1">
        Restaurant console — accept orders, mark ready, then couriers are dispatched (Bolt-style flow).
      </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['pending', 'active', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filter === f
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f === 'pending' ? 'Awaiting accept' : f === 'active' ? 'In kitchen' : 'All'}
          </button>
        ))}
        <button
          onClick={load}
          className="px-4 py-2 rounded-lg text-sm bg-gray-900 text-white w-full sm:w-auto sm:ml-auto"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading orders…</p>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-500">
          No orders in this view
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order._id}
              className="bg-white rounded-xl border shadow-sm p-5 flex flex-col md:flex-row md:items-start gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-lg">{order.restaurantName}</h2>
                  <StatusBadge status={order.status} />
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {order.customer?.name || 'Customer'} · {order.customer?.phone || '—'}
                </p>
                <p className="text-sm text-gray-500 mt-1">{order.delivery?.address}</p>
                <ul className="mt-3 text-sm text-gray-800 space-y-1">
                  {order.items?.map((item, i) => (
                    <li key={i}>
                      {item.quantity}× {item.name} — {formatCurrency(item.price * item.quantity)}
                    </li>
                  ))}
                </ul>
                {order.notes ? (
                  <p className="text-sm text-orange-700 mt-2">Note: {order.notes}</p>
                ) : null}
                <p className="font-semibold mt-3">{formatCurrency(order.total)} total</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(order.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[140px]">
                {order.status === 'PLACED' && (
                  <>
                    <Button
                      disabled={acting === order._id}
                      onClick={() => act(order._id, 'accept')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1 inline" />
                      Accept
                    </Button>
                    <Button
                      disabled={acting === order._id}
                      onClick={() => act(order._id, 'reject')}
                      variant="outline"
                      className="border-red-300 text-red-600"
                    >
                      <XCircle className="h-4 w-4 mr-1 inline" />
                      Decline
                    </Button>
                  </>
                )}
                {order.status === 'PREPARING' && (
                  <Button
                    disabled={acting === order._id}
                    onClick={() => act(order._id, 'ready')}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    <ChefHat className="h-4 w-4 mr-1 inline" />
                    Mark ready
                  </Button>
                )}
                {order.status === 'READY_FOR_PICKUP' && (
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Courier dispatching…
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PLACED: 'bg-yellow-100 text-yellow-800',
    PREPARING: 'bg-blue-100 text-blue-800',
    READY_FOR_PICKUP: 'bg-purple-100 text-purple-800',
    PICKED_UP: 'bg-indigo-100 text-indigo-800',
    DELIVERED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full ${colors[status] || 'bg-gray-100'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
