import InstallPrompt from './components/InstallPrompt'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import FindClinics from './pages/FindClinics'
import ClinicDetail from './pages/ClinicDetail'
import DoctorProfilePage from './pages/DoctorProfile'
import BookAppointment from './pages/BookAppointment'
import BookingStatus from './pages/BookingStatus'
import RegisterClinic from './pages/RegisterClinic'
import TelehealthPage from './pages/Telehealth'
import PreVisitForm from './pages/PreVisitForm'

export default function App() {
  return (
    <>
      <InstallPrompt appName="BHarath Health" />
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/clinics" element={<FindClinics />} />
        <Route path="/clinics/:slug" element={<ClinicDetail />} />
        <Route path="/doctor/:id" element={<DoctorProfilePage />} />
        <Route path="/book" element={<BookAppointment />} />
        <Route path="/booking/:code" element={<BookingStatus />} />
        <Route path="/register" element={<RegisterClinic />} />
        <Route path="/telehealth" element={<TelehealthPage />} />
        <Route path="/previsit/:token" element={<PreVisitForm />} />
      </Routes>
    </BrowserRouter>
    </>
  )
}
