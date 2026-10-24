import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from './components/layout/AdminLayout'
import { ShopLayout } from './components/layout/ShopLayout'
import Home from './pages/shop/Home'
import { Menu, Product } from './pages/shop/Menu'
import Checkout from './pages/shop/Checkout'
import { OrderPage, TrackLookup } from './pages/shop/Order'
import { About, Contact, Policy } from './pages/shop/Info'
import Brand from './pages/Brand'
import Orders from './pages/admin/Orders'
import MenuAdmin from './pages/admin/Menu'
import Today from './pages/admin/Today'
import Setup from './pages/admin/Setup'
import { Analytics, Customers, Promotions } from './pages/admin/Others'
import { EmptyState } from './components/ui/ui'
import { refresh, useDataStatus } from './data/store'

export default function App() {
  const { status, error } = useDataStatus()
  if (status === 'loading') return <div role="status" className="mx-auto max-w-6xl space-y-4 px-4 py-10" aria-busy="true" aria-label="Loading"><div className="skeleton h-16 rounded-2xl" /><div className="skeleton h-80 rounded-3xl" /><div className="skeleton h-40 rounded-3xl" /></div>
  if (status === 'error') return <div className="mx-auto max-w-xl px-4 py-20"><EmptyState title="We couldn't load the menu" body={`Please check your connection and try again. (${error})`} action={<button className="rounded-full bg-brand-600 px-5 py-2.5 font-semibold text-white" onClick={() => void refresh()}>Try again</button>} /></div>
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<ShopLayout />}>
          <Route index element={<Home />} />
          <Route path="menu" element={<Menu />} />
          <Route path="menu/:slug" element={<Product />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="order/:token" element={<OrderPage />} />
          <Route path="track" element={<TrackLookup />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="policies/:kind" element={<Policy />} />
          <Route path="brand" element={<Brand />} />
          <Route path="*" element={<div className="mx-auto max-w-xl px-4 py-20"><EmptyState title="Page not found" /></div>} />
        </Route>
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<Today />} />
          <Route path="orders" element={<Orders />} />
          <Route path="menu" element={<MenuAdmin />} />
          <Route path="setup" element={<Setup />} />
          <Route path="customers" element={<Customers />} />
          <Route path="promotions" element={<Promotions />} />
          <Route path="analytics" element={<Analytics />} />
          {/* old addresses still work */}
          <Route path="kitchen" element={<Navigate to="/admin" replace />} />
          <Route path="calendar" element={<Navigate to="/admin/setup?tab=times" replace />} />
          <Route path="delivery" element={<Navigate to="/admin/setup?tab=delivery" replace />} />
          <Route path="payments" element={<Navigate to="/admin/setup?tab=payments" replace />} />
          <Route path="content" element={<Navigate to="/admin/setup?tab=website" replace />} />
          <Route path="settings" element={<Navigate to="/admin/setup?tab=business" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
