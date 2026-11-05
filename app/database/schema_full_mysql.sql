-- QLDAPM / Intern Management - MySQL 8.0+
-- Chỉ là script tạo CSDL thủ công. Thông thường chỉ cần schema.sql + JPA ddl-auto=update.
-- Không chạy trên cơ sở dữ liệu sản xuất khi chưa sao lưu.
CREATE DATABASE IF NOT EXISTS intern_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE intern_management;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL,
  PRIMARY KEY (id), UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS department (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  PRIMARY KEY (id), UNIQUE KEY uk_department_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS intern_profiles (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  department_id BIGINT NOT NULL,
  mentor_id BIGINT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(255) NOT NULL DEFAULT 'ACTIVE',
  progress INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_profile_user (user_id),
  KEY ix_profile_department (department_id),
  KEY ix_profile_mentor (mentor_id),
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_profile_department FOREIGN KEY (department_id) REFERENCES department(id),
  CONSTRAINT fk_profile_mentor FOREIGN KEY (mentor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description VARCHAR(2000),
  priority VARCHAR(255) NOT NULL DEFAULT 'MEDIUM',
  status VARCHAR(32) NOT NULL DEFAULT 'TODO',
  deadline DATE NOT NULL,
  intern_id BIGINT NOT NULL,
  mentor_id BIGINT NOT NULL,
  completion_note VARCHAR(2000),
  PRIMARY KEY (id),
  KEY ix_task_intern (intern_id), KEY ix_task_mentor (mentor_id),
  CONSTRAINT fk_task_intern FOREIGN KEY (intern_id) REFERENCES intern_profiles(id),
  CONSTRAINT fk_task_mentor FOREIGN KEY (mentor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS weekly_reports (
  id BIGINT NOT NULL AUTO_INCREMENT,
  intern_id BIGINT NOT NULL,
  week_number INT NOT NULL,
  completed_work VARCHAR(3000),
  learned VARCHAR(3000),
  problems VARCHAR(3000),
  plan_next_week VARCHAR(3000),
  status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED',
  mentor_comment VARCHAR(3000),
  rating DOUBLE,
  PRIMARY KEY (id),
  UNIQUE KEY uk_report_intern_week (intern_id, week_number),
  CONSTRAINT fk_report_intern FOREIGN KEY (intern_id) REFERENCES intern_profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS evaluation (
  id BIGINT NOT NULL AUTO_INCREMENT,
  intern_id BIGINT NOT NULL,
  mentor_id BIGINT NOT NULL,
  technical_skill DOUBLE NOT NULL,
  communication DOUBLE NOT NULL,
  teamwork DOUBLE NOT NULL,
  responsibility DOUBLE NOT NULL,
  overall_score DOUBLE NOT NULL,
  comment VARCHAR(3000),
  PRIMARY KEY (id),
  UNIQUE KEY uk_evaluation_intern (intern_id),
  KEY ix_evaluation_mentor (mentor_id),
  CONSTRAINT fk_evaluation_intern FOREIGN KEY (intern_id) REFERENCES intern_profiles(id),
  CONSTRAINT fk_evaluation_mentor FOREIGN KEY (mentor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash VARCHAR(64) NOT NULL,
  user_id BIGINT NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  PRIMARY KEY (token_hash),
  KEY ix_session_user (user_id),
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
