# 2. BA - Requirements

## Actors
### Admin
- Xem dashboard.
- Tao/sua/xoa intern.
- Xem mentor va department.

### Mentor
- Xem intern duoc phan cong.
- Tao task cho intern cua minh.
- Review bao cao tuan.
- Tao danh gia cuoi ky.

### Intern
- Xem task cua minh.
- Cap nhat TODO -> IN_PROGRESS -> COMPLETED.
- Nop bao cao tuan.
- Xem danh gia cua minh.

## User stories
### US01 - Login
As a user, I want to login so that I can access functions for my role.

Acceptance criteria:
- Email/password dung -> login thanh cong.
- Sai thong tin -> HTTP 401 va thong bao loi.
- Frontend luu token va role.

### US02 - Admin creates intern
As an Admin, I want to create an intern profile so that the intern can be managed in the system.

Acceptance criteria:
- Email khong trung.
- Phai chon Department va Mentor.
- End date phai sau Start date.

### US03 - Mentor assigns task
As a Mentor, I want to assign a task to my intern so that I can track work progress.

Acceptance criteria:
- Mentor chi giao task cho intern minh quan ly.
- Deadline nam trong khoang thuc tap.
- Task moi co status TODO.

### US04 - Intern updates task
As an Intern, I want to update my task status so that my mentor can track progress.

Acceptance criteria:
- Chi sua task cua chinh minh.
- Thu tu hop le: TODO -> IN_PROGRESS -> COMPLETED.
- Khong cho TODO -> COMPLETED truc tiep.

### US05 - Weekly report
As an Intern, I want to submit a weekly report so that my mentor can review my work.

Acceptance criteria:
- Mot intern chi co mot bao cao cho moi week number.
- Bao cao moi co status SUBMITTED.
- Mentor duoc phep them comment/rating va chuyen REVIEWED.

### US06 - Final evaluation
As a Mentor, I want to evaluate an intern so that the internship result is recorded.

Acceptance criteria:
- Diem thanh phan 0-10.
- Overall score la trung binh 4 diem thanh phan.
- Mentor chi danh gia intern duoc phan cong.

## Business rules
- BR01: Email user la duy nhat.
- BR02: Intern phai thuoc mot Department.
- BR03: Intern phai co Mentor.
- BR04: Task deadline phai nam trong internship start/end date.
- BR05: Intern khong duoc xem task cua intern khac.
- BR06: Mentor khong duoc giao task cho intern cua mentor khac.
- BR07: Task status chi di TODO -> IN_PROGRESS -> COMPLETED.
- BR08: Diem danh gia nam trong 0..10.
