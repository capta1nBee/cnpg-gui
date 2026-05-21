import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';

interface Environment {
  id: string;
  name: string;
  apiServerUrl?: string;
  status: string;
  isDefault: boolean;
}

interface TenantContextType {
  environments: Environment[];
  activeEnvironmentId: string | null;
  setActiveEnvironmentId: (id: string) => void;
  refreshEnvironments: () => Promise<void>;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [activeEnvironmentId, setActiveEnvironmentIdState] = useState<string | null>(() => {
    return localStorage.getItem('activeEnvironmentId');
  });
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated } = useAuth();

  const fetchEnvironments = async () => {
    // Don't attempt to fetch when not authenticated — this prevents the
    // 401 → redirect → reload infinite loop on the login page.
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.get('/environments');
      const envs = res.data;
      setEnvironments(envs);

      if (envs.length > 0) {
        // If current active is not in the new list, or no active is set
        if (!activeEnvironmentId || !envs.find((e: Environment) => e.id === activeEnvironmentId)) {
          const defaultEnv = envs.find((e: Environment) => e.isDefault) || envs[0];
          setActiveEnvironmentIdState(defaultEnv.id);
          localStorage.setItem('activeEnvironmentId', defaultEnv.id);
        }
      } else {
        setActiveEnvironmentIdState(null);
        localStorage.removeItem('activeEnvironmentId');
      }
    } catch (err) {
      console.error('Failed to fetch environments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Re-fetch environments whenever authentication state changes
  // (e.g. after successful login, or after logout)
  useEffect(() => {
    fetchEnvironments();
  }, [isAuthenticated]);

  const setActiveEnvironmentId = (id: string) => {
    setActiveEnvironmentIdState(id);
    localStorage.setItem('activeEnvironmentId', id);
  };

  return (
    <TenantContext.Provider value={{
      environments,
      activeEnvironmentId,
      setActiveEnvironmentId,
      refreshEnvironments: fetchEnvironments,
      isLoading
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
