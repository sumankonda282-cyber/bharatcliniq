import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import FindClinics from './pages/FindClinics'
import ClinicDetail from './pages/ClinicDetail'
import BookAppointment from './pages/BookAppointment'
import BookingStatus from './pages/BookingStatus'
import RegisterClinic from './pages/RegisterClinic'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/clinics" element={<FindClinics />} />
        <Route path="/clinics/:slug" element={<ClinicDetail />} />
        <Route path="/book" element={<BookAppointment />} />
        <Route path="/booking/:code" element={<BookingStatus />} />
        <Route path="/register" element={<RegisterClinic />} />
      </Routes>
    </BrowserRouter>
  )
}
