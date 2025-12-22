"use client";

import React, { useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Waves, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Login = () => {
  const { session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) {
      navigate('/dashboard');
    }
  }, [session, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4">
      <div className="mb-8 w-full max-w-md">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="text-slate-400 hover:text-white gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Button>
      </div>

      <Card className="w-full max-w-md shadow-2xl border-white/5 bg-slate-900 text-white">
        <CardHeader className="text-center space-y-1">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-600/20">
              <Waves className="w-10 h-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-black uppercase tracking-tight">Gig Studio Pro</CardTitle>
          <CardDescription className="text-slate-400">
            Sign in or create an account to start managing your repertoire.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Auth
            supabaseClient={supabase}
            providers={['google']}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#4f46e5',
                    brandAccent: '#4338ca',
                    inputBackground: 'transparent',
                    inputText: 'white',
                    inputPlaceholder: '#64748b',
                    inputBorder: '#1e293b',
                    inputBorderFocus: '#4f46e5',
                    inputBorderHover: '#334155',
                  },
                },
              },
              className: {
                container: 'w-full',
                button: 'w-full font-bold uppercase tracking-widest text-[10px] h-11 rounded-xl transition-all',
                input: 'w-full bg-slate-950 border-slate-800 text-white rounded-xl h-11',
                label: 'text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5',
                anchor: 'text-indigo-400 hover:text-indigo-300 transition-colors font-bold text-xs',
                message: 'text-xs text-red-400 font-medium mt-2',
              }
            }}
            theme="dark"
          />
        </CardContent>
      </Card>

      <p className="mt-8 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
        Secure Enterprise Grade Authentication
      </p>
    </div>
  );
};

export default Login;