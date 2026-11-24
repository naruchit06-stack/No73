import { Routes, Route } from "react-router";
import { Toaster } from "sonner";
import Home from "./pages/Home";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Library from "./pages/Library";
import StoryDetail from "./pages/StoryDetail";
import Admin from "./pages/Admin";
import { PlayerProvider } from "@/providers/PlayerProvider";
import { PlayerBar } from "@/components/PlayerBar";
import { SiteHeader } from "@/components/SiteHeader";

export default function App() {
  return (
    <PlayerProvider>
      <div className="min-h-[100dvh] pb-28">
        <SiteHeader />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/library" element={<Library />} />
          <Route path="/story/:slug" element={<StoryDetail />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <PlayerBar />
        <Toaster theme="dark" position="top-center" closeButton />
      </div>
    </PlayerProvider>
  );
}
