import { PageHeader } from "@/components/ui/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Plus, Search, User, Mail, Shield } from "lucide-react"
import { RoleGuard } from "@/components/auth/RoleGuard"

export default function UsersPage() {
  return (
    <RoleGuard requiredRoles={["admin"]}>
      <UsersContent />
    </RoleGuard>
  )
}

function UsersContent() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage team members and user access permissions."
      >
        <div className="flex space-x-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search users..." className="pl-8 w-64" />
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[
          {
            name: "John Doe",
            email: "john.doe@dirtfree.com",
            role: "Admin",
            status: "active",
            lastLogin: "2024-01-20"
          },
          {
            name: "Jane Smith",
            email: "jane.smith@dirtfree.com",
            role: "Manager",
            status: "active",
            lastLogin: "2024-01-19"
          },
          {
            name: "Mike Johnson",
            email: "mike.johnson@dirtfree.com",
            role: "Technician",
            status: "inactive",
            lastLogin: "2024-01-15"
          }
        ].map((user, i) => (
          <Card key={i} className="rounded-lg p-4 md:p-5 lg:p-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{user.name}</CardTitle>
                <Badge variant={user.status === "active" ? "default" : "secondary"}>
                  {user.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center text-sm text-muted-foreground">
                <Mail className="mr-2 h-4 w-4" />
                {user.email}
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <Shield className="mr-2 h-4 w-4" />
                {user.role}
              </div>
              <div className="pt-2 border-t">
                <div className="text-xs text-muted-foreground">
                  Last login: {user.lastLogin}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}