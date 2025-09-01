import { type User, type InsertUser, type Project, type InsertProject, type AnalysisResult, type InsertAnalysis } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;
  
  getAnalysisResults(projectId: string): Promise<AnalysisResult[]>;
  createAnalysisResult(analysis: InsertAnalysis): Promise<AnalysisResult>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private projects: Map<string, Project>;
  private analysisResults: Map<string, AnalysisResult>;

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.analysisResults = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const now = new Date();
    const project: Project = { 
      ...insertProject, 
      id,
      userId: null,
      createdAt: now,
      updatedAt: now
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const existing = this.projects.get(id);
    if (!existing) return undefined;
    
    const updated = { 
      ...existing, 
      ...updates, 
      updatedAt: new Date() 
    };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }

  async getAnalysisResults(projectId: string): Promise<AnalysisResult[]> {
    return Array.from(this.analysisResults.values()).filter(
      result => result.projectId === projectId
    );
  }

  async createAnalysisResult(insertAnalysis: InsertAnalysis): Promise<AnalysisResult> {
    const id = randomUUID();
    const analysisResult: AnalysisResult = {
      ...insertAnalysis,
      id,
      createdAt: new Date()
    };
    this.analysisResults.set(id, analysisResult);
    return analysisResult;
  }
}

export const storage = new MemStorage();
