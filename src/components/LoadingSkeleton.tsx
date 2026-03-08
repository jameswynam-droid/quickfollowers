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
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-10 w-32" />
    </div>
    
    <div className="flex gap-4">
      <Skeleton className="h-10 flex-1 max-w-md" />
      <Skeleton className="h-10 w-48" />
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(9)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex justify-between pt-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

export const OrdersSkeleton = () => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-10 w-36" />
    </div>
    
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex gap-4 border-b pb-4">
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className="h-5 flex-1" />
            ))}
          </div>
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex gap-4 py-2">
              {[...Array(7)].map((_, j) => (
                <Skeleton key={j} className="h-5 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);

export const TransactionsSkeleton = () => (
  <div className="space-y-6">
    <Skeleton className="h-10 w-48" />
    
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex gap-4 border-b pb-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-5 flex-1" />
            ))}
          </div>
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex gap-4 py-2">
              {[...Array(5)].map((_, j) => (
                <Skeleton key={j} className="h-5 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);