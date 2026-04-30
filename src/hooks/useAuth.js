import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data);
    setLoading(false);
  }

  async function refreshProfile() {
    if (!user) return;
    await fetchProfile(user.id);
  }

  async function updateProfile(updates) {
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);
    if (error) throw error;
    await fetchProfile(user.id);
  }

  async function uploadAvatar(file) {
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (error) throw error;

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);

    await updateProfile({ avatar_url: publicUrl });
    return publicUrl;
  }

  async function signUp(email, password, fullName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    if (data.session) {
      await supabase.from("profiles").insert({
        id: data.user.id,
        full_name: fullName,
      });
    }
    return data;
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    uploadAvatar,
    refreshProfile,
  };
}
