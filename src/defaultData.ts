import { AppData } from './types';

export const initialAppData: AppData = {
  settings: {
    theme: 'dark',
    accentColor: 'orange',
    language: 'en',
    autoSave: true,
    version: '1.0.0',
    auth: {
      username: 'admin',
      passwordHash: '$2y$10$e0MYzXyjpJS7Pd0RVvHwHe8fG6a/1m3X5T3I.6d2.z/w.7e8e9e1m'
    },
    activeTimer: null
  },
  persons: [
    {
      id: 'person-1',
      name: 'Alex Rivera',
      email: 'alex@struktur.com',
      role: 'Product Designer',
      color: '#f97316',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200'
    },
    {
      id: 'person-2',
      name: 'Sarah Jenkins',
      email: 'sarah@struktur.com',
      role: 'Lead Developer',
      color: '#10b981',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200'
    },
    {
      id: 'person-3',
      name: 'Budi Santoso',
      email: 'budi@struktur.com',
      role: 'Senior Editor',
      color: '#3b82f6',
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=200'
    },
    {
      id: 'person-4',
      name: 'Siti Rahma',
      email: 'siti@struktur.com',
      role: 'QA Engineer',
      color: '#ec4899',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'
    }
  ],
  projects: [
    {
      id: 'proj-1',
      type: 'project-node',
      title: 'Digital Literacy Video',
      status: 'active',
      color: '#e4e4e7',
      description: 'Nested work packages and task hierarchy. Parent items automatically calculate completion rollups from all subordinate sub-items.',
      actualStartDate: '2026-08-01T08:00:00.000Z',
      actualEndDate: '2026-08-20T17:00:00.000Z',
      items: [
        {
          id: 'item-wt7',
          type: 'item-node',
          name: 'WT 7',
          targetDate: '2026-08-12T23:59:59Z',
          actualStartDate: null,
          actualEndDate: null,
          status: 'completed',
          assigneeId: 'person-1',
          estimatedSeconds: 28800,
          notes: 'Walkthrough module 7 media assets',
          sessions: [],
          subItems: [
            {
              id: 'item-wt7-u2',
              type: 'item-node',
              name: 'DL_WT7_Unit 2',
              targetDate: '2026-08-12T23:59:59Z',
              actualStartDate: null,
              actualEndDate: null,
              status: 'not-started',
              assigneeId: 'person-2',
              estimatedSeconds: 18000,
              notes: 'Unit 2 production steps',
              sessions: [],
              subItems: [
                {
                  id: 'item-wt7-u2-s2-1',
                  type: 'item-node',
                  name: 'DL_WT7_U2_S2_1',
                  targetDate: '2026-08-12T23:59:59Z',
                  actualStartDate: null,
                  actualEndDate: null,
                  status: 'not-started',
                  assigneeId: 'person-2',
                  estimatedSeconds: 14400,
                  notes: 'Section 2 segment 1 recording and editing',
                  sessions: [],
                  subItems: [
                    {
                      id: 'task-screen-prep',
                      type: 'item-node',
                      name: 'Arsitektur Sistem Desain Perusahaan – Tahap 2',
                      targetDate: '2024-10-24T23:59:59Z',
                      actualStartDate: '2024-10-10T08:00:00Z',
                      actualEndDate: null,
                      status: 'in-progress',
                      assigneeId: 'person-1',
                      reviewerId: 'person-2',
                      estimatedSeconds: 18000,
                      notes: 'Koordinasikan dengan tim engineering untuk memfinalisasi pemetaan token untuk pustaka komponen bersama. Kita perlu memastikan bahwa palet utama sesuai dengan pedoman branding baru dan mendukung mode terang serta gelap dengan mulus.\n\nOutput utama:\n- Token warna semantik yang difinalisasi\n- Dokumentasi untuk variabel spasi dan radius\n- Pertemuan tinjauan dengan pengembang utama',
                      sessions: [
                        {
                          id: 'sess-prep-1',
                          startedAt: '2024-10-12T08:00:00Z',
                          endedAt: '2024-10-12T12:21:00Z',
                          loggedSeconds: 15660
                        }
                      ],
                      subItems: []
                    },
                    {
                      id: 'task-video-rec',
                      type: 'item-node',
                      name: 'Video Screen Rec',
                      targetDate: null,
                      actualStartDate: null,
                      actualEndDate: null,
                      status: 'not-started',
                      assigneeId: 'person-2',
                      estimatedSeconds: 10800,
                      notes: 'Record voiceover and screen actions',
                      sessions: [],
                      subItems: []
                    },
                    {
                      id: 'task-1st-edit',
                      type: 'item-node',
                      name: '1st Round Video Editing',
                      targetDate: null,
                      actualStartDate: null,
                      actualEndDate: null,
                      status: 'not-started',
                      assigneeId: 'person-2',
                      estimatedSeconds: 14400,
                      notes: 'Rough cut assembly and sound leveling',
                      sessions: [],
                      subItems: []
                    },
                    {
                      id: 'task-compress',
                      type: 'item-node',
                      name: 'Compress',
                      targetDate: null,
                      actualStartDate: null,
                      actualEndDate: null,
                      status: 'not-started',
                      assigneeId: 'person-1',
                      estimatedSeconds: 3600,
                      notes: 'H.264 mp4 export & thumbnail generation',
                      sessions: [],
                      subItems: []
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'proj-2',
      type: 'project-node',
      title: 'Review',
      status: 'active',
      color: '#f59e0b',
      actualStartDate: '2026-08-10T00:00:00Z',
      actualEndDate: '2026-08-13T23:59:59Z',
      items: [
        {
          id: 'item-reprint',
          type: 'item-node',
          name: 'Reprint by Manna',
          targetDate: '2026-08-12T23:59:59Z',
          actualStartDate: '2026-08-10T00:00:00Z',
          actualEndDate: '2026-08-13T23:59:59Z',
          status: 'in-progress',
          assigneeId: 'person-1',
          estimatedSeconds: 14400,
          notes: 'Verify layout reprint specifications',
          sessions: [
            {
              id: 'sess-01',
              startedAt: '2026-08-10T09:00:00Z',
              endedAt: '2026-08-10T10:00:00Z',
              loggedSeconds: 3600
            }
          ],
          subItems: [
            {
              id: 'sub-mphsci',
              type: 'item-node',
              name: 'MPHSCI_3_4_WB_3E_DIVERSITY_TE',
              targetDate: '2026-08-13T23:59:59Z',
              actualStartDate: '2026-08-13T00:00:00Z',
              actualEndDate: '2026-08-13T23:59:59Z',
              status: 'in-progress',
              assigneeId: 'person-1',
              estimatedSeconds: 7200,
              notes: 'Proofing workbook chapter 3',
              sessions: [
                {
                  id: 'sess-02',
                  startedAt: '2026-08-13T09:00:00Z',
                  endedAt: '2026-08-13T10:43:00Z',
                  loggedSeconds: 6180
                }
              ],
              subItems: []
            }
          ]
        }
      ]
    },
    {
      id: 'proj-3',
      type: 'project-node',
      title: 'Marketing Campaign 2026',
      status: 'active',
      color: '#10b981',
      actualStartDate: '2026-08-05T00:00:00Z',
      actualEndDate: '2026-08-25T23:59:59Z',
      items: [
        {
          id: 'item-social',
          type: 'item-node',
          name: 'Social Media Launch',
          targetDate: '2026-08-18T23:59:59Z',
          actualStartDate: '2026-08-05T00:00:00Z',
          actualEndDate: null,
          status: 'review',
          assigneeId: 'person-3',
          estimatedSeconds: 28800,
          notes: 'Promotional graphics and campaign videos',
          sessions: [],
          subItems: [
            {
              id: 'item-insta',
              type: 'item-node',
              name: 'Instagram Teaser Video',
              targetDate: '2026-08-10T23:59:59Z',
              actualStartDate: '2026-08-06T00:00:00Z',
              actualEndDate: '2026-08-10T23:59:59Z',
              status: 'completed',
              assigneeId: 'person-3',
              estimatedSeconds: 14400,
              notes: '15s dynamic reel',
              sessions: [
                {
                  id: 'sess-insta-1',
                  startedAt: '2026-08-06T10:00:00Z',
                  endedAt: '2026-08-06T14:00:00Z',
                  loggedSeconds: 14400
                }
              ],
              subItems: []
            }
          ]
        }
      ]
    },
    {
      id: 'proj-4',
      type: 'project-node',
      title: 'Mobile App Redesign',
      status: 'archived',
      color: '#64748b',
      actualStartDate: '2026-01-01T00:00:00Z',
      actualEndDate: '2026-03-30T23:59:59Z',
      items: [
        {
          id: 'item-audit',
          type: 'item-node',
          name: 'Legacy UI Audit',
          targetDate: '2026-02-15T23:59:59Z',
          actualStartDate: '2026-01-10T00:00:00Z',
          actualEndDate: '2026-02-14T23:59:59Z',
          status: 'completed',
          assigneeId: 'person-1',
          estimatedSeconds: 36000,
          notes: 'Archived UX research phase',
          sessions: [],
          subItems: []
        }
      ]
    }
  ],
  activityLogs: [
    {
      id: 'log-1',
      timestamp: '2026-08-12T12:21:00.000Z',
      userId: 'person-1',
      userName: 'Project Manager',
      action: 'timer_stopped',
      details: 'Logged 4h 21m on Screen Recording Prep',
      itemId: 'task-screen-prep',
      itemTitle: 'Screen Recording Prep'
    },
    {
      id: 'log-2',
      timestamp: '2026-08-12T08:00:00.000Z',
      userId: 'person-1',
      userName: 'Project Manager',
      action: 'timer_started',
      details: 'Started timer on Screen Recording Prep',
      itemId: 'task-screen-prep',
      itemTitle: 'Screen Recording Prep'
    },
    {
      id: 'log-3',
      timestamp: '2026-08-10T10:43:00.000Z',
      userId: 'person-1',
      userName: 'Project Manager',
      action: 'status_change',
      details: 'Updated status to IN PROGRESS on Reprint by Manna',
      itemId: 'item-reprint',
      itemTitle: 'Reprint by Manna'
    }
  ]
};
