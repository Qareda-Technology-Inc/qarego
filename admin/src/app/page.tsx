
"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Users, Car, MapPin, DollarSign, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { fetcher } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import DashboardMap from "@/components/DashboardMap";

interface StatItem {
  name: string;
  stat: string;
  change: string;
  changeType: 'increase' | 'decrease';
}

export default function Dashboard() {
  const [stats, setStats] = useState<StatItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await fetcher('/admin/stats');
        setStats(data.stats);
      } catch (error) {
        console.error("Failed to fetch dashboard stats", error);
        // Fallback to zeros or empty state if fetch fails
        setStats([
          { name: 'Total Rides (Today)', stat: '0', change: '0%', changeType: 'increase' },
          { name: 'Active Drivers', stat: '0', change: '0%', changeType: 'increase' },
          { name: 'New Sign-ups', stat: '0', change: '0%', changeType: 'increase' },
          { name: 'Revenue (Today)', stat: formatCurrency(0), change: '0%', changeType: 'increase' },
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  const getIcon = (name: string) => {
    switch (name) {
      case 'Total Rides (Today)': return MapPin;
      case 'Active Drivers':
      case 'Online Drivers': return Car;
      case 'New Sign-ups': return Users;
      case 'Revenue (Today)': return DollarSign;
      default: return MapPin;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0">
      <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Dashboard</h2>
      
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => {
          const Icon = getIcon(item.name);
          return (
            <Card key={item.name}>
              <CardContent className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Icon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">{item.name}</dt>
                      <dd>
                        <div className="text-lg font-medium text-gray-900">{item.stat}</div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </CardContent>
              <div className="bg-gray-50 px-5 py-3">
                <div className="text-sm">
                  <span className={item.changeType === 'increase' ? 'text-green-600' : 'text-red-600'}>
                     {item.change}
                  </span>
                  <span className="text-gray-500"> from yesterday</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-2 sm:pb-4">
          <h3 className="text-base sm:text-lg font-medium text-gray-900">Live Map</h3>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Online drivers and active trips update every 10 seconds
          </p>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
          <div className="w-full rounded-lg overflow-hidden border border-gray-200 h-[min(50vh,320px)] sm:h-80 md:h-96">
            <DashboardMap />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
