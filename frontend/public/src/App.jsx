import InstallPrompt from './components/InstallPrompt'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import FindClinics from './pages/FindClinics'
import ClinicDetail from './pages/ClinicDetail'
import BookAppointment from './pages/BookAppointment'
import BookingStatus from './pages/BookingStatus'
import RegisterLanding from './pages/RegisterLanding'
import RegisterForm from './pages/RegisterForm'
import TelehealthPage from './pages/Telehealth'
import PharmacyOrder from './pages/PharmacyOrder'

export default function App() {
  return (
    <>
      <InstallPrompt appName="BHarath Health Systems" />
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/clinics" element={<FindClinics />} />
        <Route path="/clinics/:slug" element={<ClinicDetail />} />
        <Route path="/book" element={<BookAppointment />} />
        <Route path="/booking/:code" element={<BookingStatus />} />
        <Route path="/register" element={<RegisterLanding />} />
        <Route path="/register/:type" element={<RegisterForm />} />
        <Route path="/telehealth" element={<TelehealthPage />} />
        <Route path="/pharmacy" element={<PharmacyOrder />} />
      </Routes>
    </BrowserRouter>
    </>
  )
}