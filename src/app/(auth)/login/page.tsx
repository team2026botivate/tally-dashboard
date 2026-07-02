"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/lib/auth-provider';
import { loginSchema, type LoginValues } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Field,
  FieldLabel,
  FieldContent,
  FieldError,
} from '@/components/ui/field';
import { 
  CommandIcon,
  EyeIcon,
  EyeOffIcon,
  RefreshCwIcon,
  ArrowRightIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedGridPattern } from '@/components/ui/animated-grid-pattern';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginValues) => {
    try {
      await login(values.username, values.password);
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err.message || 'Login failed';
      setError('root', { message: msg });
      toast.error(msg);
    }
  };

  return (
    <div className="flex min-h-svh w-full bg-white text-zinc-900 selection:bg-zinc-100">
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div className="grid w-full lg:grid-cols-2">
        {/* Left Column - Minimal Panel (No text, logo, or icons) */}
        <div className="hidden lg:flex flex-col items-center justify-center p-12 bg-zinc-50 border-r border-zinc-100 select-none relative overflow-hidden">
          {/* Animated Grid Pattern */}
          <AnimatedGridPattern
            numSquares={30}
            maxOpacity={0.2}
            duration={3}
            repeatDelay={1}
            className={cn(
              "[mask-image:radial-gradient(500px_circle_at_center,white,transparent)]",
              "inset-y-[-30%] h-[200%] skew-y-12 fill-zinc-300/30 stroke-zinc-300/30",
            )}
          />
        </div>

        {/* Right Column - Minimal Form */}
        <div className="flex items-center justify-center p-8 bg-white">
          <div className="w-full max-w-[320px] space-y-8 animate-fade-in-up">
            {/* Header / Logo */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex size-8 items-center justify-center rounded-lg bg-zinc-950 text-white">
                  <CommandIcon className="size-4" />
                </div>
                <span className="font-semibold text-sm tracking-tight text-zinc-900">Tally Gateway</span>
              </div>
              <h1 className="text-xl font-medium tracking-tight text-zinc-900">
                Sign in
              </h1>
              <p className="text-zinc-400 text-xs">
                Enter your system credentials below.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-3">
                {/* Username */}
                <Field orientation="vertical" className="gap-1">
                  <FieldLabel htmlFor="username" className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                    Username
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      id="username"
                      type="text"
                      placeholder="Enter username"
                      className="h-10 w-full px-3 bg-white border border-zinc-200 focus-visible:border-zinc-950 focus-visible:ring-1 focus-visible:ring-zinc-950 transition-all rounded-lg text-sm text-zinc-900 placeholder:text-zinc-300 outline-none"
                      {...register('username')}
                    />
                    <FieldError errors={[errors.username]} />
                  </FieldContent>
                </Field>

                {/* Password */}
                <Field orientation="vertical" className="gap-1">
                  <FieldLabel htmlFor="password" className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                    Password
                  </FieldLabel>
                  <FieldContent>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter password"
                        className="h-10 w-full pl-3 pr-10 bg-white border border-zinc-200 focus-visible:border-zinc-950 focus-visible:ring-1 focus-visible:ring-zinc-950 transition-all rounded-lg text-sm text-zinc-900 placeholder:text-zinc-300 outline-none"
                        {...register('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-900 transition-colors focus:outline-none cursor-pointer"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOffIcon className="size-4" />
                        ) : (
                          <EyeIcon className="size-4" />
                        )}
                      </button>
                    </div>
                    <FieldError errors={[errors.password]} />
                  </FieldContent>
                </Field>
              </div>

              {errors.root && (
                <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs text-zinc-600 text-center font-medium">
                  {errors.root.message}
                </div>
              )}

              <Button 
                type="submit" 
                disabled={isSubmitting} 
                className="group w-full h-10 bg-zinc-950! hover:bg-zinc-900! text-zinc-50! font-medium transition-all duration-150 flex items-center justify-center gap-1.5 active:scale-[0.98] rounded-lg cursor-pointer text-sm"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCwIcon className="animate-spin size-3.5" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </Button>


              {/* Botivate Branding */}
              <div className="text-center pt-6 border-t border-zinc-100">
                <p className="text-sm text-zinc-400 font-medium tracking-wide">
                  Powered By{' '}
                  <a 
                    href="https://www.botivate.in" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-zinc-900 hover:text-zinc-700 transition-colors underline underline-offset-4 font-semibold"
                  >
                    Botivate
                  </a>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
