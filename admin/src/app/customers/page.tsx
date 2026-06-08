"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useEffect, useState } from "react";
import { fetcher } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { User, Phone, Mail, Star, Calendar, Trash2, Edit2, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

interface Customer {
  _id: string;
  name: string;
  phone: string;
  email: string;
  totalRatings: number;
  averageRating: number;
  isSuspended?: boolean;
  createdAt: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', isSuspended: false });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await fetcher('/customers');
      setCustomers(data.customers || []);
    } catch (error) {
      console.error("Failed to load customers", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    try {
      await fetcher(`/customers/${id}`, { method: 'DELETE' });
      setCustomers(customers.filter(c => c._id !== id));
    } catch (error) {
      alert("Failed to delete customer");
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      isSuspended: !!customer.isSuspended,
    });
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', email: '', isSuspended: false });
    setIsModalOpen(true);
  };

  const handleToggleSuspended = async (customer: Customer) => {
    try {
      await fetcher(`/customers/${customer._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isSuspended: !customer.isSuspended }),
      });
      loadCustomers();
    } catch (e) {
      alert('Failed to update status');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await fetcher(`/customers/${editingCustomer._id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: formData.name, phone: formData.phone, email: formData.email, isSuspended: formData.isSuspended })
        });
      } else {
        // Create - Note: Backend route needs to support creation if we add this. 
        // For now, if no create route, we might show error or just skip. 
        // Wait, I didn't add create route for customer yet. Let's stick to Edit for now or add Create.
        // User asked for CRUD. I should add Create to backend too.
        // Let's assume I will add it or have added it? I haven't added createCustomer.
        // I'll add createCustomer to backend in a moment.
        await fetcher('/customers', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
      }
      setIsModalOpen(false);
      loadCustomers();
    } catch (error) {
      console.error(error);
      alert("Operation failed");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-gray-500">Loading customers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage your customer base"
        actions={
          <Button onClick={handleAdd} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Customer Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="md:hidden space-y-3">
            {customers.map((customer) => (
              <div key={customer._id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
                    {customer.name ? customer.name.charAt(0).toUpperCase() : <User className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">{customer.name || "Unknown"}</p>
                    <p className="text-xs text-gray-500">{customer.phone}</p>
                    {customer.email ? <p className="text-xs text-gray-400 truncate">{customer.email}</p> : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleSuspended(customer)}
                    className={`px-2 py-1 rounded-full text-xs font-medium ${customer.isSuspended ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}
                  >
                    {customer.isSuspended ? "Suspended" : "Active"}
                  </button>
                  <span className="text-xs text-gray-500 flex items-center">
                    <Star className="h-3 w-3 text-yellow-400 fill-current mr-0.5" />
                    {customer.averageRating ? customer.averageRating.toFixed(1) : "N/A"}
                  </span>
                  <div className="ml-auto flex gap-3">
                    <button type="button" onClick={() => handleEdit(customer)} className="text-indigo-600">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => handleDelete(customer._id)} className="text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {customers.map((customer) => (
                  <tr key={customer._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                           <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                             {customer.name ? customer.name.charAt(0).toUpperCase() : <User className="h-5 w-5" />}
                           </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{customer.name || "Unknown"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center text-sm text-gray-500">
                          <Phone className="mr-1.5 h-3.5 w-3.5" />
                          {customer.phone}
                        </div>
                        {customer.email && (
                          <div className="flex items-center text-sm text-gray-500">
                            <Mail className="mr-1.5 h-3.5 w-3.5" />
                            {customer.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleSuspended(customer)}
                        className={`px-2 py-1 rounded-full text-xs font-medium ${customer.isSuspended ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}
                      >
                        {customer.isSuspended ? 'Suspended' : 'Active'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Star className="mr-1.5 h-4 w-4 text-yellow-400 fill-current" />
                        {customer.averageRating ? customer.averageRating.toFixed(1) : "N/A"}
                        <span className="text-gray-400 ml-1">({customer.totalRatings})</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="mr-1.5 h-3.5 w-3.5" />
                        {new Date(customer.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => handleEdit(customer)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(customer._id)} className="text-red-600 hover:text-red-900">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {customers.length === 0 && (
                <div className="text-center py-4 text-gray-500">No customers found.</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCustomer ? "Edit Customer" : "Add New Customer"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Full Name</Label>
            <Input 
              id="name" 
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="John Doe"
              required
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input 
              id="phone" 
              value={formData.phone} 
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              placeholder="+233..."
              required
            />
          </div>
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input 
              id="email" 
              type="email"
              value={formData.email} 
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              placeholder="john@example.com"
            />
          </div>
          {editingCustomer && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isSuspended"
                checked={formData.isSuspended}
                onChange={(e) => setFormData({ ...formData, isSuspended: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="isSuspended">Suspended (cannot request rides)</Label>
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:w-auto">
              {editingCustomer ? "Save Changes" : "Add Customer"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
