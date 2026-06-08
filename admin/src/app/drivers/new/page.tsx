"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { fetcher } from "@/lib/api";
import { buildDriverPayloadFromForm } from "@/lib/driverFormUpload";

export default function NewDriverPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current) return;

    setLoading(true);
    try {
      const payload = await buildDriverPayloadFromForm(formRef.current);
      const data = await fetcher("/drivers/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      alert(data.message || "Driver registered successfully!");
      router.push("/drivers");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to register driver";
      alert(message);
      console.error("[Register driver]", message, error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link href="/drivers" className="mr-4 text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h2 className="text-2xl font-semibold text-gray-900">Register New Driver</h2>
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
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" name="fullName" required placeholder="John Doe" />
            </div>
            
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" name="email" type="email" required placeholder="john@example.com" />
            </div>

            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" name="phone" type="tel" required placeholder="+233XXXXXXXXX" />
              <p className="text-xs text-gray-500 mt-1">Use +233 format. Rider logs in with this exact number via OTP.</p>
            </div>

            <div>
              <Label htmlFor="dob">Date of Birth</Label>
              <Input id="dob" name="dob" type="date" required />
            </div>

            <div>
              <Label htmlFor="gender">Gender</Label>
              <select id="gender" name="gender" className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            
             <div>
              <Label htmlFor="profileImage">Profile Photo</Label>
              <Input id="profileImage" name="profileImage" type="file" accept="image/*" className="cursor-pointer" />
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
            </div>

            <div>
              <Label htmlFor="licenseBack">Driver&apos;s License (Back)</Label>
              <Input id="licenseBack" name="licenseBack" type="file" accept="image/*,.pdf" className="cursor-pointer" />
            </div>

            <div>
              <Label htmlFor="nationalId">National ID / Passport</Label>
              <Input id="nationalId" name="nationalId" type="file" accept="image/*,.pdf" className="cursor-pointer" />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="policeClearance">Police Clearance Certificate</Label>
              <Input id="policeClearance" name="policeClearance" type="file" accept="image/*,.pdf" className="cursor-pointer" />
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
              <Input id="makeModel" name="makeModel" placeholder="e.g. Toyota Prius" required />
            </div>

            <div>
              <Label htmlFor="year">Year</Label>
              <Input id="year" name="year" type="number" placeholder="2020" required />
            </div>

            <div>
              <Label htmlFor="plateNumber">License Plate Number</Label>
              <Input id="plateNumber" name="plateNumber" required placeholder="ABC-123" />
            </div>

            <div>
              <Label htmlFor="color">Color</Label>
              <Input id="color" name="color" required placeholder="White" />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="category">Vehicle Category (Ride Type)</Label>
              <select id="category" name="category" defaultValue="motorcycle" className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
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
            </div>

            <div>
              <Label htmlFor="insurance">Commercial Insurance</Label>
              <Input id="insurance" name="insurance" type="file" accept="image/*,.pdf" className="cursor-pointer" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-4">
          <Button type="button" variant="outline" className="mr-4" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Registering..." : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Register Driver
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
