"use client";

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { fetcher } from '@/lib/api';
import { canOpenPage, homeFor, type AdminRole } from '@/lib/adminAccess';

interface User {
  userId: string;
  name: string;
  role: string;
  /** super | admin | staff (see lib/adminAccess.ts). */
  adminRole?: AdminRole;
  /** On a temporary password: must choose their own before anything else. */
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string, refreshToken: string, userData: User) => void;
  logout: () => void;
  /** Update the signed-in user (e.g. after changing the password). */
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
  updateUser: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const saveUser = useCallback((next: User | null) => {
    if (next) localStorage.setItem('user', JSON.stringify(next));
    setUser(next);
  }, []);

  useEffect(() => {
    // Check for token on mount, then refresh the role from the server (it may have changed).
    const token = localStorage.getItem('accessToken');
    const userData = localStorage.getItem('user');
    let stored: User | null = null;
    try {
      stored = token && userData ? (JSON.parse(userData) as User) : null;
    } catch {
      stored = null;
    }
    const t = setTimeout(() => {
      setUser(stored);
      setLoading(false);
    }, 0);
    if (stored) {
      fetcher('/admin/me')
        .then((data) => {
          const me = data?.user;
          if (me) {
            saveUser({ ...stored!, name: me.name ?? stored!.name, adminRole: me.adminRole, mustChangePassword: me.mustChangePassword });
          }
        })
        .catch(() => {
          /* offline or signed out: fetcher handles a dead session */
        });
    }
    return () => clearTimeout(t);
  }, [saveUser]);

  useEffect(() => {
    // Protect routes: signed in, own password chosen, and only pages this role may open.
    if (loading) return;
    if (!user) {
      if (pathname !== '/login') router.push('/login');
      return;
    }
    if (user.mustChangePassword) {
      if (pathname !== '/account/password') router.push('/account/password');
      return;
    }
    if (pathname === '/login') {
      router.push(homeFor(user.adminRole));
    } else if (!canOpenPage(user.adminRole, pathname)) {
      router.replace(homeFor(user.adminRole));
    }
  }, [user, loading, pathname, router]);

  const login = (token: string, refreshToken: string, userData: User) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', refreshToken);
    saveUser(userData);
    router.push(userData.mustChangePassword ? '/account/password' : homeFor(userData.adminRole));
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/login');
  };

  const updateUser = (patch: Partial<User>) => {
    if (user) saveUser({ ...user, ...patch });
  };

  // Don't draw a page this person can't open (it would fire requests the server refuses);
  // the effect above is already sending them somewhere else.
  const blocked =
    !!user &&
    ((user.mustChangePassword && pathname !== '/account/password') || !canOpenPage(user.adminRole, pathname));

  if (loading || blocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
