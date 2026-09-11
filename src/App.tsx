// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { WhatsAppConnection } from "./WhatsAppConnection";
import { provisionWorkspaceWithGateway } from "./lib/workspaceProvisioning";

const SUPABASE_URL = "https://zzhqhgeyxbdqdkacrviq.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6aHFoZ2V5eGJkcWRrYWNydmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDMwNDEsImV4cCI6MjA5NDU3OTA0MX0.C4xDheJF3qOB7L3LWZKryNgE4-eMc05kJi4qwDhp-sI";
const API = "https://zedping-backend-production.up.railway.app";
const ZEDPING_WA = "260778621167";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
const WORKSPACE_STORAGE_KEY = "zedping.activeWorkspaceId";
const nativeRequest = window.fetch.bind(window);

const apiFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init.headers || {});
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);

  // This local value is only a convenience hint. The backend independently
  // verifies that the signed-in user belongs to the requested workspace.