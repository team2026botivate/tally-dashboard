import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function LoginLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="flex flex-col gap-6 w-full max-w-sm">
        <Card>
          <CardHeader className="text-center">
            <Skeleton className="h-6 w-40 mx-auto" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
