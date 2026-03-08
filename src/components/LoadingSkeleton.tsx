import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const DashboardSkeleton = () => (
  <div className="space-y-6 sm:space-y-8">
    {/* Welcome header */}
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 sm:h-9 w-44" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>

    {/* Stats Grid */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="p-3 sm:p-5 pb-1 sm:pb-1">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-5 pt-1 sm:pt-2 space-y-3">
            <Skeleton className="h-7 sm:h-8 w-24" />
            <Skeleton className="h-9 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>

    {/* Recent Orders */}
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent className="p-4 sm:px-6 sm:pb-6 pt-0">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex justify-between items-center gap-4">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-4 w-16 hidden sm:block" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);

export const ServicesSkeleton = () => (
  <div className="space-y-6 sm:space-y-8">
    {/* Page header */}
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="space-y-1.5">
        <Skeleton className="h-8 sm:h-10 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>

    {/* Search + Filter */}
    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
      <Skeleton className="h-10 flex-1" />
      <Skeleton className="h-10 w-full sm:w-64" />
    </div>

    {/* Collapsible category cards */}
    <div className="space-y-3 sm:space-y-4">
      {[...Array(6)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-40 sm:w-56" />
                <Skeleton className="h-3.5 w-20" />
              </div>
              <Skeleton className="h-5 w-5 rounded" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

export const OrdersSkeleton = () => (
  <div className="space-y-6 sm:space-y-8">
    {/* Page header */}
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
      <div className="space-y-1.5">
        <Skeleton className="h-8 sm:h-10 w-44" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-9 w-24" />
    </div>

    {/* Search + Filter */}
    <div className="flex flex-col sm:flex-row gap-3">
      <Skeleton className="h-10 flex-1" />
      <Skeleton className="h-10 w-full sm:w-[150px]" />
    </div>

    {/* Table */}
    <Card>
      <CardContent className="p-0 sm:p-6">
        <div className="space-y-3 p-4 sm:p-0">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 sm:gap-4">
              <Skeleton className="h-4 w-2/5 sm:w-1/4" />
              <Skeleton className="h-4 w-16 hidden sm:block" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16 hidden sm:block" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20 hidden md:block" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);

export const TransactionsSkeleton = () => (
  <div className="space-y-6 sm:space-y-8">
    {/* Page header */}
    <div className="flex items-center gap-3 sm:gap-4">
      <Skeleton className="h-10 w-10 rounded-md" />
      <div className="space-y-1.5">
        <Skeleton className="h-8 sm:h-10 w-44" />
        <Skeleton className="h-4 w-52" />
      </div>
    </div>

    {/* Table card */}
    <Card>
      <CardHeader className="p-3 sm:p-6">
        <Skeleton className="h-6 w-36" />
      </CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0">
        <div className="space-y-3 p-4 sm:p-0">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 sm:gap-4">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-16 font-mono" />
              <Skeleton className="h-4 w-16 hidden sm:block" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20 hidden md:block" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);

export const TicketsSkeleton = () => (
  <div className="space-y-6 sm:space-y-8">
    {/* Page header */}
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
      <div className="space-y-1.5">
        <Skeleton className="h-8 sm:h-10 w-48" />
        <Skeleton className="h-4 w-44" />
      </div>
      <Skeleton className="h-9 w-28" />
    </div>

    {/* Ticket cards */}
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4 sm:w-1/2" />
                <Skeleton className="h-3.5 w-32" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

export const AccountSkeleton = () => (
  <div className="space-y-6">
    {/* Profile header */}
    <Skeleton className="h-28 w-full rounded-2xl" />

    {/* Settings cards */}
    {[...Array(3)].map((_, i) => (
      <Card key={i}>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);
