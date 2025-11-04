// src/app/(dashboard)/dashboard/customers/[id]/portal/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle,
  XCircle,
  Key,
  Mail,
  Calendar,
  ExternalLink,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface PortalStatus {
  accountExists: boolean;
  email: string;
  userId?: string;
  createdAt?: string;
  lastLogin?: string;
}

interface ProvisioningResult {
  success: boolean;
  message?: string;
  accountExists?: boolean;
  userId?: string;
  email: string;
  tempPassword?: string;
  status?: PortalStatus;
  error?: string;
}

// ============================================================================
// Component
// ============================================================================

export default function CustomerPortalPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [revokingAccess, setRevokingAccess] = useState(false);
  const [portalStatus, setPortalStatus] = useState<PortalStatus | null>(null);
  const [provisioningResult, setProvisioningResult] = useState<ProvisioningResult | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Fetch portal status on mount
  useEffect(() => {
    fetchPortalStatus();
  }, [customerId]);

  // ============================================================================
  // API Functions
  // ============================================================================

  async function fetchPortalStatus() {
    setLoading(true);
    try {
      const response = await fetch(`/api/customers/${customerId}/provision-portal`);

      if (!response.ok) {
        throw new Error('Failed to fetch portal status');
      }

      const data = await response.json();
      setPortalStatus(data);
    } catch (error) {
      console.error('Error fetching portal status:', error);
      toast.error('Failed to load portal status');
    } finally {
      setLoading(false);
    }
  }

  async function createPortalAccount() {
    setProvisioning(true);
    setProvisioningResult(null);

    try {
      const response = await fetch(`/api/customers/${customerId}/provision-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sendWelcomeEmail: true,
          autoConfirmEmail: true,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Provisioning failed');
      }

      setProvisioningResult(data);
      setPortalStatus(data.status || null);

      if (data.accountExists) {
        toast.info('Portal account already exists');
      } else {
        toast.success('Portal account created successfully!');
      }
    } catch (error) {
      console.error('Error creating portal account:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create portal account');
    } finally {
      setProvisioning(false);
    }
  }

  async function sendPasswordReset() {
    if (!portalStatus?.email) return;

    setResettingPassword(true);

    try {
      const response = await fetch(`/api/customers/${customerId}/provision-portal`, {
        method: 'PATCH',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send password reset');
      }

      toast.success('Password reset email sent!');
    } catch (error) {
      console.error('Error sending password reset:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send password reset');
    } finally {
      setResettingPassword(false);
    }
  }

  async function revokePortalAccess() {
    if (!confirm('Are you sure you want to revoke portal access for this customer?')) {
      return;
    }

    setRevokingAccess(true);

    try {
      const response = await fetch(`/api/customers/${customerId}/provision-portal`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to revoke access');
      }

      toast.success('Portal access revoked');
      await fetchPortalStatus();
    } catch (error) {
      console.error('Error revoking portal access:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to revoke access');
    } finally {
      setRevokingAccess(false);
    }
  }

  function copyPasswordToClipboard() {
    if (!provisioningResult?.tempPassword) return;

    navigator.clipboard.writeText(provisioningResult.tempPassword);
    setCopiedPassword(true);
    toast.success('Password copied to clipboard');

    setTimeout(() => {
      setCopiedPassword(false);
    }, 2000);
  }

  // ============================================================================
  // Render
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Portal Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Customer Portal Access
                {portalStatus?.accountExists ? (
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                ) : (
                  <ShieldAlert className="h-5 w-5 text-amber-600" />
                )}
              </CardTitle>
              <CardDescription>
                Manage customer access to the customer portal
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchPortalStatus}
              disabled={loading}
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {portalStatus?.accountExists ? (
            // Account Exists - Show Details
            <>
              <div className="flex items-center gap-2 text-green-600 font-medium">
                <CheckCircle className="h-5 w-5" />
                <span>Portal account is active</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Portal Email</Label>
                  <div className="flex items-center gap-2">
                    <Input value={portalStatus.email} readOnly className="bg-muted" />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(portalStatus.email);
                        toast.success('Email copied');
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>User ID</Label>
                  <Input
                    value={portalStatus.userId || 'N/A'}
                    readOnly
                    className="bg-muted font-mono text-sm"
                  />
                </div>

                {portalStatus.createdAt && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Account Created
                    </Label>
                    <Input
                      value={new Date(portalStatus.createdAt).toLocaleString()}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                )}

                {portalStatus.lastLogin && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Last Login
                    </Label>
                    <Input
                      value={new Date(portalStatus.lastLogin).toLocaleString()}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={sendPasswordReset}
                  disabled={resettingPassword}
                >
                  {resettingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Send Password Reset
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'http://localhost:3009';
                    window.open(portalUrl, '_blank');
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Portal
                </Button>

                <Button
                  variant="destructive"
                  onClick={revokePortalAccess}
                  disabled={revokingAccess}
                  className="ml-auto"
                >
                  {revokingAccess ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Revoking...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Revoke Access
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            // No Account - Show Create Option
            <>
              <div className="flex items-center gap-2 text-amber-600 font-medium">
                <ShieldAlert className="h-5 w-5" />
                <span>This customer doesn't have a portal account yet</span>
              </div>

              <Alert>
                <Key className="h-4 w-4" />
                <AlertDescription>
                  Creating a portal account will:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Generate a secure temporary password</li>
                    <li>Send a welcome email with login credentials</li>
                    <li>Grant access to the customer portal</li>
                    <li>Allow the customer to view service history and book appointments</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Customer Email</Label>
                <Input value={portalStatus?.email || 'N/A'} readOnly className="bg-muted" />
              </div>

              <Button onClick={createPortalAccount} disabled={provisioning} size="lg" className="w-full">
                {provisioning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Create Portal Account
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Provisioning Result Card (Shows temporary password after creation) */}
      {provisioningResult && provisioningResult.tempPassword && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              Portal Account Created Successfully
            </CardTitle>
            <CardDescription>
              Share these credentials with the customer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-white">
              <Key className="h-4 w-4" />
              <AlertDescription>
                <strong>⚠️ Important:</strong> This is the only time the temporary password will be shown.
                Make sure to save it or send it to the customer immediately.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={provisioningResult.email}
                readOnly
                className="bg-white"
              />
            </div>

            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={provisioningResult.tempPassword}
                  readOnly
                  className="bg-white font-mono"
                  type="text"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyPasswordToClipboard}
                >
                  <Copy className={cn('h-4 w-4', copiedPassword && 'text-green-600')} />
                </Button>
              </div>
            </div>

            <Alert className="bg-blue-50 border-blue-200">
              <Mail className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                A welcome email with these credentials has been sent to <strong>{provisioningResult.email}</strong>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Portal Features Card */}
      <Card>
        <CardHeader>
          <CardTitle>Portal Features</CardTitle>
          <CardDescription>
            What customers can do with portal access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-medium">Service History</div>
                <div className="text-sm text-muted-foreground">
                  View all past and upcoming services
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-medium">Online Booking</div>
                <div className="text-sm text-muted-foreground">
                  Book and manage appointments 24/7
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-medium">Loyalty Rewards</div>
                <div className="text-sm text-muted-foreground">
                  Track and redeem loyalty points
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-medium">Payment Management</div>
                <div className="text-sm text-muted-foreground">
                  View invoices and payment history
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-medium">Account Management</div>
                <div className="text-sm text-muted-foreground">
                  Update profile and preferences
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-medium">Before/After Photos</div>
                <div className="text-sm text-muted-foreground">
                  View photos from completed services
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
