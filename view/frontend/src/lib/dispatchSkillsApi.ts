import { request } from "@/lib/apiClient";

export type DispatchSkill = {
  filename: string;
  title: string;
  size: number;
  enabled: boolean;
};

export async function fetchDispatchSkills(): Promise<DispatchSkill[]> {
  const data = await request<{ skills: DispatchSkill[] }>("/api/agent/skills");
  return data.skills;
}

export async function uploadDispatchSkill(filename: string, content: string): Promise<DispatchSkill> {
  const data = await request<{ skill: DispatchSkill }>("/api/agent/skills", {
    method: "POST",
    body: JSON.stringify({ filename, content }),
  });
  return data.skill;
}

export async function patchDispatchSkillsEnabled(enabled: string[]): Promise<DispatchSkill[]> {
  const data = await request<{ skills: DispatchSkill[] }>("/api/agent/skills/enabled", {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
  return data.skills;
}

export async function deleteDispatchSkill(filename: string): Promise<DispatchSkill[]> {
  const data = await request<{ skills: DispatchSkill[] }>(
    `/api/agent/skills/${encodeURIComponent(filename)}`,
    { method: "DELETE" },
  );
  return data.skills;
}

export function readMarkdownFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
