# Báo cáo kiểm thử: quy tắc nghiệp vụ IMS (7 TC chưa có test tự động)

- Ngày: 2026-11-05, múi giờ Asia/Bangkok
- File kiểm thử: `app/backend/src/test/java/com/example/internms/BusinessRuleTest.java` (file mới)
- Không sửa `src/main`, test có sẵn hoặc `pom.xml`. Không commit.
- Môi trường: H2 in-memory chế độ MySQL, profile `demo`. Không gọi server :8081 và không dùng MySQL thật.

## Kết quả tổng quan

Cả 8 test trong `BusinessRuleTest` đạt ở cả hai lần chạy, không có test nào bị `@Disabled`. Hành vi thực tế của ứng dụng khớp với bảy TC được yêu cầu, nên không có defect nào được ghi nhận. Trạng thái: DONE.

## Lệnh đã chạy

`mvn -B -Djava.version=17 test -Dtest=BusinessRuleTest`, chạy 2 lần. Lần 1 có dòng tóm tắt gốc:

```
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 12.48 s -- in com.example.internms.BusinessRuleTest
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

Lần 2 cho kết quả tương tự: `Tests run: 8, Failures: 0, Errors: 0, Skipped: 0`, thời gian 9.412 s, `BUILD SUCCESS`. Log Maven đầy đủ nằm ở `C:\Users\tranv\AppData\Local\Temp\claude\c16b8cdaf0373962\44d36a7c-96d6-4d7c-9ac8-a6830f79c0ae\scratchpad\business-rule-run1.log` và `business-rule-run2.log`.

## Ánh xạ TC sang test

| TC | Kịch bản | Test method | Kiểm tra | Kết quả |
|---|---|---|---|---|
| TC04 | Tạo intern trùng email | `duplicateInternEmailIsRejectedCaseInsensitively` | 409 cho email trùng, kể cả khi viết hoa | PASS |
| TC05 | Ngày kết thúc không sau ngày bắt đầu | `internEndDateNotAfterStartDateIsRejected` | 400 khi end = start và khi end < start. Sau khi bị từ chối, cùng email với ngày hợp lệ vẫn tạo được (200) | PASS |
| TC08 | Deadline task ngoài kỳ thực tập | `taskDeadlineOutsideInternshipIsRejected` | 400 với 2026-08-31 và 2027-07-01. 200 với hai ngày biên 2026-09-01 và 2027-06-30 | PASS |
| TC10 | Intern chuyển TODO sang COMPLETED | `internCannotMoveTaskFromTodoDirectlyToCompleted` | 400. Task vẫn ở TODO. Đối chứng: TODO sang IN_PROGRESS sang COMPLETED vẫn 200 | PASS |
| TC13 | Nộp báo cáo trùng tuần | `secondWeeklyReportForSameWeekIsRejected` | 409. Chỉ còn 1 báo cáo với nội dung ban đầu. Tuần khác vẫn 200 | PASS |
| TC15 | Điểm báo cáo ngoài 0..10 | `mentorReportRatingOutsideZeroToTenIsRejected` | 400 với 11 và -1. Trạng thái vẫn SUBMITTED. Điểm 10 được chấp nhận và chuyển sang REVIEWED | PASS |
| TC15 | Điểm đánh giá ngoài 0..10 | `evaluationScoreOutsideZeroToTenIsRejected` | 400 với 11, -1 và 10.5. Mentor không có đánh giá nào được lưu. Điểm 0 và 10 được chấp nhận, overall = 5.0 | PASS |
| TC18 | Intern xem đánh giá của người khác | `internCannotReadAnotherInternsEvaluation` | 403. Đối chứng: chủ sở hữu đọc được đánh giá của chính mình (200) | PASS |

## Giả định và cách xử lý dữ liệu

- TC04 trong tài liệu không ghi mã HTTP cụ thể. Test dùng 409, theo `app/docs/04-api-contract.md` (409 là dữ liệu trùng).
- TC15 được hiểu là áp dụng cho cả điểm nhận xét báo cáo (`ReportController.review`) và điểm đánh giá cuối kỳ (`EvaluationController`), vì cả hai đều có quy tắc 0..10.
- Test không so sánh nội dung thông báo lỗi, chỉ so sánh mã HTTP và trạng thái dữ liệu.
- Mỗi test tự tạo phòng ban, mentor và intern với email duy nhất (UUID). Không có thứ tự phụ thuộc giữa các test.
- Test chỉ đăng nhập thành công (admin seed `admin@gmail.com`, và các tài khoản vừa tạo), không có lần đăng nhập sai nào. Vì vậy cơ chế khóa đăng nhập đang được thêm song song sẽ không bị kích hoạt.

## Defect

Không có. Không test nào bị `@Disabled`, và không có hành vi nào mâu thuẫn với tài liệu.

## Vấn đề và lưu ý

- Chưa chạy full suite `mvn test`, vì yêu cầu chỉ là chạy class mới. Test `ErrorHandlingAndLoginLimitTest` của agent khác có trong cây test và được biên dịch cùng, nhưng không được chạy do bộ lọc `-Dtest`.
- Chưa kiểm chứng test có thật sự bắt được lỗi hay không (mutation check). Không được sửa `src/main`, nên không thể cố tình phá quy tắc để xem test có fail không. Các assertion kiểm tra mã HTTP và trạng thái dữ liệu thật, nhưng khả năng bắt lỗi chỉ được suy ra từ việc đọc mã.
- `git status` hiện có thay đổi của agent khác (`ApiExceptionHandler.java`, `AuthService.java`, `App.jsx`, `ErrorHandlingAndLoginLimitTest.java`). Các thay đổi này nằm ngoài phạm vi và tôi không đụng đến.

## Câu hỏi còn mở

1. Có cần chạy full suite `mvn test` sau khi agent kia hoàn tất không?
2. Có muốn thực hiện mutation check trên một bản sao của dự án để chứng minh các test này fail khi quy tắc bị phá không?
