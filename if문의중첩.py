# if문의중첩.py
id = "user"
pwd = "1234"

userid = input("id를 입력:")
passwd = input("password를 입력:")

if id == userid:
    if pwd == passwd:
        print("정상적인 로그인")
    else:
        print("암호가 틀렸습니다.")
else:
    print("id가 틀렸습니다.")

