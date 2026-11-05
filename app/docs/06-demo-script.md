# 6. Demo Script 7-10 phut

## PM - 60 giay
- Gioi thieu bai toan, scope MVP, 5 vai tro.
- Cho xem sprint plan va risk register.

## BA - 60-90 giay
- Trinh bay 3 actor: Admin, Mentor, Intern.
- Chon 2 business rule quan trong: mentor chi giao task cho intern cua minh; task status khong duoc TODO -> COMPLETED.

## FE/BE - 4-5 phut
1. Admin login: `admin@gmail.com / 123456`.
2. Admin mo Interns va tao mot Intern moi.
3. Logout -> Mentor login: `mentor@gmail.com / 123456`.
4. Mentor tao task cho intern.
5. Logout -> Intern login: `intern@gmail.com / 123456`.
6. Intern mo Tasks va chuyen TODO -> IN_PROGRESS.
7. Intern chuyen IN_PROGRESS -> COMPLETED.
8. Intern nop Weekly Report.
9. Logout -> Mentor login, review report, tao Final Evaluation.
10. Mo Dashboard de xem thong ke.

## Tester - 60-90 giay
- Test positive: TODO -> IN_PROGRESS -> PASS.
- Test negative: thu TODO -> COMPLETED -> he thong phai bao loi.
- Test negative: deadline task ngoai ky thuc tap -> he thong phai tu choi.
- Cho xem bug report mau va trang thai Fixed/Retest/Closed.

## Cau ket
He thong da the hien day du requirement -> development -> testing -> release theo quy trinh quan ly du an phan mem.
