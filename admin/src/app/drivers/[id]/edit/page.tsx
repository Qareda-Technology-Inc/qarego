
"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DriverWorkModeEditor } from "@/components/DriverWorkModeEditor";
import { DriverReliabilityEditor } from "@/components/DriverReliabilityEditor";
import { DriverDispatchAnalyticsCard } from "@/components/DriverDispatchAnalyticsCard";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useRef, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { fetcher } from "@/lib/api";
import { buildDriverPayloadFromForm } from "@/lib/driverFormUpload";
import { resolveMediaUrl } from "@/lib/mediaUrl";

export default function EditDriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [driver, setDriver] = useState<any>(null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const loadDriver = async () => {
      try {
        const data = await fetcher(`/drivers/${id}`);
        setDriver(data.driver);
      } catch (error) {
        console.error("Failed to load driver", error);
        alert("Failed to load driver details");
        router.push('/drivers');
      } finally {
        setInitialLoading(false);
      }
    };
    loadDriver();
  }, [id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!formRef.current) return;

    try {
      const payload = await buildDriverPayloadFromForm(formRef.current);
      await fetcher(`/drivers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      alert('Driver updated successfully!');
      router.push('/drivers');
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Update failed");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!driver) return null;

  const vehicle = driver.driverDetails?.vehicle || {};
  const details = driver.driverDetails || {};

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link href="/drivers" className="mr-4 text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h2 className="text-2xl font-semibold text-gray-900">Edit Driver</h2>
        </div>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6" encType="multipart/form-data">
        {/* Personal Details */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium text-gray-900">Personal Information</h3>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" name="name" required defaultValue={driver.name} placeholder="John Doe" />
            </div>
            
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" name="email" type="email" required defaultValue={driver.email} placeholder="john@example.com" />
            </div>

            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" name="phone" type="tel" required defaultValue={driver.phone} placeholder="+1234567890" />
            </div>

            <div>
              <Label htmlFor="dob">Date of Birth</Label>
              <Input id="dob" name="dob" type="date" required defaultValue={details.dob} />
            </div>

            <div>
              <Label htmlFor="gender">Gender</Label>
              <select 
                id="gender" 
                name="gender" 
                defaultValue={details.gender}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <Label htmlFor="status">Driver status</Label>
              <select
                id="status"
                name="status"
                defaultValue={details.status || "pending"}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="suspended_debt">Suspended (Debt)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Only Active drivers can receive ride offers</p>
            </div>
            
             <div>
              <Label htmlFor="profileImage">Profile Photo</Label>
              <Input id="profileImage" name="profileImage" type="file" accept="image/*" className="cursor-pointer" />
              {details.profileImage && (
                <p className="text-xs text-green-600 mt-1">
                  <a href={resolveMediaUrl(details.profileImage) || "#"} target="_blank" rel="noreferrer" className="underline">
                    View current photo
                  </a>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium text-gray-900">Documents</h3>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="licenseFront">Driver&apos;s License (Front)</Label>
              <Input id="licenseFront" name="licenseFront" type="file" accept="image/*,.pdf" className="cursor-pointer" />
              {details.licenseFront && (
                <p className="text-xs text-green-600 mt-1">
                  <a href={resolveMediaUrl(details.licenseFront) || "#"} target="_blank" rel="noreferrer" className="underline">View front</a>
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="licenseBack">Driver&apos;s License (Back)</Label>
              <Input id="licenseBack" name="licenseBack" type="file" accept="image/*,.pdf" className="cursor-pointer" />
              {details.licenseBack && (
                <p className="text-xs text-green-600 mt-1">
                  <a href={resolveMediaUrl(details.licenseBack) || "#"} target="_blank" rel="noreferrer" className="underline">View back</a>
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="nationalId">National ID / Passport</Label>
              <Input id="nationalId" name="nationalId" type="file" accept="image/*,.pdf" className="cursor-pointer" />
              {details.nationalId && <p className="text-xs text-green-600 mt-1">Current file uploaded</p>}
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="policeClearance">Police Clearance Certificate</Label>
              <Input id="policeClearance" name="policeClearance" type="file" accept="image/*,.pdf" className="cursor-pointer" />
              {details.policeClearance && <p className="text-xs text-green-600 mt-1">Current file uploaded</p>}
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Information */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium text-gray-900">Vehicle Assignment</h3>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
             <div>
              <Label htmlFor="makeModel">Make & Model</Label>
              <Input 
                id="makeModel" 
                name="makeModel" 
                placeholder="e.g. Toyota Prius" 
                required 
                defaultValue={vehicle.make && vehicle.model ? `${vehicle.make} ${vehicle.model}` : ''} 
              />
            </div>

            <div>
              <Label htmlFor="year">Year</Label>
              <Input id="year" name="year" type="number" placeholder="2020" required defaultValue={vehicle.year} />
            </div>

            <div>
              <Label htmlFor="plateNumber">License Plate Number</Label>
              <Input id="plateNumber" name="plateNumber" required placeholder="ABC-123" defaultValue={vehicle.plateNumber} />
            </div>

            <div>
              <Label htmlFor="color">Color</Label>
              <Input id="color" name="color" required placeholder="White" defaultValue={vehicle.color} />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="category">Vehicle Category (Ride Type)</Label>
              <select 
                id="category" 
                name="category" 
                defaultValue={vehicle.category || "motorcycle"}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                <option value="motorcycle">Motorcycle</option>
                <option value="pragya">Pragya (Tricycle)</option>
                <option value="comfort">Comfort (Car)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Assign which ride type this driver can accept</p>
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Documents */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium text-gray-900">Vehicle Documents</h3>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="registration">Vehicle Registration / Logbook</Label>
              <Input id="registration" name="registration" type="file" accept="image/*,.pdf" className="cursor-pointer" />
              {vehicle.registrationDoc && <p className="text-xs text-green-600 mt-1">Current file uploaded</p>}
            </div>

            <div>
              <Label htmlFor="insurance">Commercial Insurance</Label>
              <Input id="insurance" name="insurance" type="file" accept="image/*,.pdf" className="cursor-pointer" />
              {vehicle.insuranceDoc && <p className="text-xs text-green-600 mt-1">Current file uploaded</p>}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-4">
          <Button type="button" variant="outline" className="mr-4" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Updating..." : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Update Driver
              </>
            )}
          </Button>
        </div>
      </form>

      <div className="mt-8 space-y-8">
        <DriverDispatchAnalyticsCard driverId={id} />
        <DriverWorkModeEditor driverId={id} />
        <DriverReliabilityEditor driverId={id} />
      </div>
    </div>
  );
}
