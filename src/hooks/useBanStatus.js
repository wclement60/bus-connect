import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { checkUserBanned, getActiveBan } from '../services/banService';

export const useBanStatus = () => {
  const [isBanned, setIsBanned] = useState(false);
  const [banDetails, setBanDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const checkBanStatus = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const banned = await checkUserBanned(user.id);
        setIsBanned(banned);
        
        if (banned) {
          const details = await getActiveBan(user.id);
          setBanDetails(details);
        } else {
          setBanDetails(null);
        }
      } catch (error) {
        console.error('Erreur lors de la vérification du bannissement:', error);
        setIsBanned(false);
        setBanDetails(null);
      } finally {
        setLoading(false);
      }
    };

    checkBanStatus();
  }, [user?.id]);

  return { isBanned, banDetails, loading };
}; 