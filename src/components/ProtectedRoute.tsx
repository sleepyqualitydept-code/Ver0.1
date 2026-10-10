import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { hasRoutePermission } from '../security/permissions.ts';

interface Props {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles = [] }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="p-6 text-xs text-slate-500">Loading...</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  const roleAllowed = allowedRoles.length === 0 || allowedRoles.includes(user.role);
  const routeAllowed = hasRoutePermission(user.role, location.pathname);

  if (!roleAllowed || !routeAllowed) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-8 text-center">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-2">
          <div className="text-sm font-bold text-slate-800">Access Denied</div>
          <div className="text-xs text-slate-500">Current Role: {user.role}</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
