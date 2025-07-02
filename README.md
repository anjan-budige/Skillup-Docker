# SkillUp - Educational Task Management Platform

<p align="center">
  <img src="https://raw.githubusercontent.com/anjan-budige/education-task-management/refs/heads/main/homepage.png" alt="SkillUp Platform Banner"/>
</p>

---

## 📖 Project Description

**SkillUp** is a modern, full-stack educational task management platform designed to streamline the academic workflow for administrators, faculty, and students. It provides a centralized system for course and user management, task assignment, submission, and grading, complete with a powerful analytics dashboard.

The platform is built with a role-based access control system, ensuring each user type has a tailored and secure experience. From high-level administrative oversight to detailed faculty-student interaction, SkillUp aims to be the definitive tool for managing academic tasks efficiently.

---

## 🛠️ Tech Stack

This project leverages a modern, robust, and scalable technology stack:

*   **Frontend**: `React.js`, `Vite`, `Tailwind CSS`, `Framer Motion` (for animations), `Recharts` (for charts), `Axios`
*   **Backend**: `Node.js`, `Express.js`
*   **Database**: `MongoDB` with `Mongoose`
*   **Authentication**: `JSON Web Tokens (JWT)`, `bcrypt.js`, `crypto-js`
*   **File Storage**: AWS / Web Hosting
*   **Deployment**:  `Vercel` for Frontend, `Render` for Backend

---

## ✨ Key Features

The platform is divided into three distinct, feature-rich portals:

### 👨‍💼 Admin Portal

The central nervous system of the platform, providing complete oversight and control.
*   **Dashboard**: At-a-glance analytics with KPIs for total users, active tasks, and platform-wide completion rates.
*   **User Management**: Full CRUD (Create, Read, Update, Delete) functionality for both **Faculty** and **Student** accounts.
*   **Batch & Course Management**: Create student batches, create courses, and assign multiple faculty and batches to courses with a dynamic, searchable UI.
*   **Task Oversight**: View all tasks created across the platform, with options to filter and delete.
*   **Grading Interface**: A powerful "super-user" interface to view and grade submissions for any task on the platform.
*   **Advanced Analytics**: A dedicated page with interactive charts and date/department filters to analyze submission trends, course performance, and faculty effectiveness.
*   **PDF Report Generation**: Download a professional summary of the current analytics view.
*   **Platform Settings**: Configure global settings like platform name, logo, submission policies, and maintenance mode.

### 👩‍🏫 Faculty Portal

A dedicated workspace for instructors to manage their academic responsibilities.
*   **Personalized Dashboard**: View key stats relevant to the faculty's own courses, students, and tasks.
*   **Task Management**: Full CRUD capabilities for creating, updating, and deleting **their own** assignments for the courses they teach.
*   **Student Management**: View all students and add new students directly to the batches they manage.
*   **Grading Interface**: A streamlined page to view submissions and award grades/feedback for their specific tasks.

### 🎓 Student Portal

A clean, focused interface for students to engage with their coursework.
*   **Dashboard**: See an overview of enrolled courses, pending tasks, and recent grades.
*   **Task Submission**: A clear interface to view task details, download attachments, and upload submission files.
*   **Grades & Feedback**: View all graded tasks with scores and instructor feedback in one place.
*   **User Profile**: Students can manage their own profile information.

---

## 📸 Screenshots & Demo GIFs

#### Admin Dashboard
![Admin Dashboard](https://raw.githubusercontent.com/anjan-budige/education-task-management/refs/heads/main/admindashboard.png)
*The main analytics dashboard provides a high-level overview of platform activity.*

`Demo Admin Login Credentials`

`Username : Admin`
`Password : Anjan1@`

---
#### Faculty Dashboard
![Faculty Dashboard](https://raw.githubusercontent.com/anjan-budige/education-task-management/refs/heads/main/facultydashboard.png)
*Faculty Level Analytics includes assigned courses, students and able to manage/create courses, tasks, student batches, grading, etc*

`Demo Faculty Login Credentials`

`Username : faculty`
`Password : Anjan1@`

---
#### Student Dashboard
![Student Dashboard](https://raw.githubusercontent.com/anjan-budige/education-task-management/refs/heads/main/studentdashboard.png)
*Student portal for completing tasks and getting analytics of the completed tasks*

`Demo Student Login Credentials`

`Username : B22CS101`
`Password : Anjan1@`

---

Thank you for viewing my project. Please feel free to contact me if you need any further details or clarification at anjanbudige@gmail.com



