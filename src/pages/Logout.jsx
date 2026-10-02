import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function Logout({ setIsAuthenticated }) {
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.clear();
    setIsAuthenticated(false);
    navigate("/login", { replace: true });
  }, []);

  return null;
}

export default Logout;