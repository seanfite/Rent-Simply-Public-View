import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './components/Login'; 
import Dashboard from './components/Dashboard'; 
import MyProperties from './components/MyProperties';
import SideBar from './components/Sidebar';
import MobileNavBar from './components/MobileNavBar.js';
import DesktopNavBar from './components/DesktopNavBar';
import AddProperty from './components/AddProperty';
import Property from './components/Property';
import Unit from './components/Unit';
import UserContext from './UserContext';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import useWindowWidth from './hooks/UseWindowWidth';
import './Firebase.js'; 
import './components/css/global.css'

function App() {
  const [uid, setUid] = useState('');
  const [email, setEmail] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleButtonRef = useRef();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in, set the UID
        setUid(user.uid);
        setEmail(user.email);
      } else {
        // User is signed out
        setUid('');
        setEmail('');
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
    console.log("we toggled sidebar");
  };

  return (
    <UserContext.Provider value={{ uid, email }}>
      <Router>
        <LocationListener isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} toggleButtonRef={toggleButtonRef} />  
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} /> 
          <Route path="/my-properties" element={<MyProperties />} /> 
          <Route path="/add-property" element={<AddProperty />} /> 
          <Route path="/property/:propertyId" element={<Property />} />
          <Route path="/unit/:unitID/:propertyId" element={<Unit />} />
        </Routes>
      </Router>
    </UserContext.Provider>
  );
}

function LocationListener({ isSidebarOpen, toggleSidebar, toggleButtonRef }) { 
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const windowWidth = useWindowWidth(); // window width hook
  const breakpoint = 768; // breakpoint for mobile vs desktop

  return (
    <>
      {!isHomePage && (
        windowWidth < breakpoint ? 
        <MobileNavBar toggleSidebar={toggleSidebar} toggleButtonRef={toggleButtonRef} /> :
        <DesktopNavBar />
      )}
      {!isHomePage && <SideBar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />}
    </>
  );
}

export default App;
