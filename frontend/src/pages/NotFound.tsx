import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'react-toastify';

export default function NotFound() {
  const navigate = useNavigate();

  useEffect(() => {
    toast.info('Tính năng đang phát triển (Coming soon)');

    const timer = setTimeout(() => {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/', { replace: true });
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return null;
}
