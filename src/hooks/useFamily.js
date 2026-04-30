import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

export function useFamily(userId) {
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchMembers(groupId) {
    const { data } = await supabase
      .from("family_memberships")
      .select(`id, role, profiles (id, full_name)`)
      .eq("group_id", groupId);
    setMembers(data || []);
  }

  async function fetchGroups() {
    if (!userId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("family_memberships")
        .select(`role, family_groups (id, name, created_at)`)
        .eq("user_id", userId);

      const parsed = (data || []).map((m) => ({
        ...m.family_groups,
        myRole: m.role,
      }));

      setGroups(parsed);

      if (parsed.length > 0) {
        const first = parsed[0];
        setActiveGroup(first);
        setMyRole(first.myRole);
        await fetchMembers(first.id);
      }
    } catch (e) {
      console.error("fetchGroups error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchGroups();
  }, [userId]);

  async function createGroup(name) {
    const { data, error } = await supabase.rpc("create_family_group", {
      group_name: name,
    });
    if (error) throw error;
    await fetchGroups();
    return data;
  }

  async function createInvitation(groupId, role) {
    const code = generateCode();
    const { data, error } = await supabase
      .from("family_invitations")
      .insert({ group_id: groupId, code, role, created_by: userId })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function joinWithCode(code) {
    const { data, error } = await supabase.rpc("join_family_group", {
      invitation_code: code,
    });
    if (error) throw new Error(error.message);
    await fetchGroups();
    return data?.name;
  }

  async function changeRole(membershipId, newRole) {
    const { error } = await supabase
      .from("family_memberships")
      .update({ role: newRole })
      .eq("id", membershipId);
    if (error) throw error;
    if (activeGroup) await fetchMembers(activeGroup.id);
  }

  async function removeMember(membershipId) {
    const { error } = await supabase
      .from("family_memberships")
      .delete()
      .eq("id", membershipId);
    if (error) throw error;
    if (activeGroup) await fetchMembers(activeGroup.id);
  }

  async function selectGroup(group) {
    setActiveGroup(group);
    setMyRole(group.myRole);
    await fetchMembers(group.id);
  }

  async function deleteGroup(groupId) {
    const { data: mbs } = await supabase
      .from("family_memberships")
      .select("id")
      .eq("group_id", groupId);

    if (mbs && mbs.length > 1) {
      throw new Error("Solo puedes eliminar grupos sin otros miembros");
    }

    await supabase
      .from("family_memberships")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", userId);

    const { error } = await supabase
      .from("family_groups")
      .delete()
      .eq("id", groupId);

    if (error) throw error;
    await fetchGroups();
  }

  return {
    groups,
    activeGroup,
    members,
    myRole,
    loading,
    createGroup,
    createInvitation,
    joinWithCode,
    changeRole,
    removeMember,
    selectGroup,
    deleteGroup,
    refetch: fetchGroups,
  };
}
